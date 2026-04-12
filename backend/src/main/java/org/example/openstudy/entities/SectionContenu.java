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
public class SectionContenu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String contenu;

    @Enumerated(EnumType.STRING)
    private TypeContenu type;

    private LocalDateTime dateAjout = LocalDateTime.now();

    private String promptSource;

    @ManyToOne
    @JoinColumn(name = "chapitre_id")
    @JsonBackReference
    private Chapitre chapitre;

    // Getters et Setters
}