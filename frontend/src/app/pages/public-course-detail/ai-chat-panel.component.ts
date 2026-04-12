import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AIChatService, AIMessage } from '../../services/ai-chat.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-ai-chat-panel',
  standalone: false,
  template: `
    <div class="ai-chat-panel">
      <header class="chat-header">
        <h3>Assistant IA</h3>
        <p class="chat-subtitle">Modifiez le contenu ensemble</p>
      </header>

      <div class="messages-container" #messagesContainer>
        <div *ngIf="messages.length === 0" class="empty-chat">
          <p>Posez une question sur {{ chapterTitle }}</p>
          <p class="hint">Ou demandez à l'IA de générer du contenu pour vos sections.</p>
        </div>

        <div *ngFor="let message of messages" [ngClass]="'message message-' + message.role">
          <div class="message-content">{{ message.content }}</div>
          <span class="message-time">{{ message.timestamp | date:'HH:mm' }}</span>
        </div>

        <div *ngIf="isLoading" class="message message-assistant message-loading">
          <div class="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <textarea 
          #userInput
          [(ngModel)]="inputText"
          (keydown.enter)="onSendKeyDown($any($event))"
          placeholder="Demandez à l'IA... (Entrée pour envoyer)"
          class="chat-input"
          [disabled]="isLoading"
        ></textarea>
        <button 
          (click)="sendMessage()" 
          [disabled]="!inputText.trim() || isLoading"
          class="send-btn"
        >
          {{isLoading ? 'En court...' : '→'}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ai-chat-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f8f9fa;
      border-left: 1px solid #ddd;
      overflow: hidden;
    }

    .chat-header {
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-bottom: 2px solid #ddd;
    }

    .chat-header h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .chat-subtitle {
      margin: 0.25rem 0 0 0;
      font-size: 0.85rem;
      opacity: 0.9;
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .empty-chat {
      text-align: center;
      color: #999;
      padding: 2rem 1rem;
    }

    .empty-chat p {
      margin: 0.5rem 0;
      font-size: 0.95rem;
    }

    .empty-chat .hint {
      font-size: 0.85rem;
      color: #bbb;
    }

    .message {
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
      border-radius: 8px;
      background: white;
      border: 1px solid #eee;
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-user {
      background: #e3f2fd;
      border-color: #90caf9;
      align-self: flex-end;
      max-width: 85%;
    }

    .message-assistant {
      background: white;
      border-color: #ddd;
      align-self: flex-start;
      max-width: 95%;
    }

    .message-content {
      word-wrap: break-word;
      white-space: pre-wrap;
      color: #333;
      line-height: 1.4;
    }

    .message-time {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.35rem;
      align-self: flex-end;
    }

    .message-loading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .loading-dots {
      display: flex;
      gap: 0.35rem;
    }

    .loading-dots span {
      width: 6px;
      height: 6px;
      background: #999;
      border-radius: 50%;
      animation: pulse 1.4s infinite;
    }

    .loading-dots span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .loading-dots span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 0.3;
      }
      50% {
        opacity: 1;
      }
    }

    .chat-input-area {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      background: white;
      border-top: 1px solid #ddd;
    }

    .chat-input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.9rem;
      resize: none;
      height: 3rem;
    }

    .chat-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
    }

    .chat-input:disabled {
      background: #f5f5f5;
      color: #999;
    }

    .send-btn {
      width: 3rem;
      padding: 0.75rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, opacity 0.2s;
    }

    .send-btn:hover:not(:disabled) {
      transform: scale(1.05);
    }

    .send-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class AIChatPanelComponent implements OnInit, OnDestroy {
  @Input() chapterTitle: string = '';
  @Input() courseTitle: string = '';
  @Input() existingSections: string[] = [];

  messages: AIMessage[] = [];
  isLoading = false;
  inputText = '';
  private destroy$ = new Subject<void>();

  constructor(private aiChatService: AIChatService) {}

  ngOnInit(): void {
    this.aiChatService.getMessages$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages;
      });

    this.aiChatService.getIsLoading$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoading => {
        this.isLoading = isLoading;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  sendMessage(): void {
    if (!this.inputText.trim() || this.isLoading) return;

    const userMessage = this.inputText;
    this.inputText = '';

    this.aiChatService.sendMessage(
      userMessage,
      this.chapterTitle,
      this.courseTitle || this.chapterTitle,
      this.existingSections
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  onSendKeyDown(event: any): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
