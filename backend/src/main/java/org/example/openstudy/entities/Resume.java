package org.example.openstudy.entities;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class Resume {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String contenu;

    private LocalDateTime dateCreation = LocalDateTime.now();

    // Pour savoir quel modèle d'IA a généré ce résumé (ex: "GPT-4", "Llama-3")
    private String versionIA;

    @OneToOne
    @JoinColumn(name = "cours_id")
    @JsonBackReference(value = "cours-resume")
    private Cours cours;

    // Getters and Setters
}
