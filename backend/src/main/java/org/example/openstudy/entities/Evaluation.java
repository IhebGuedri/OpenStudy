package org.example.openstudy.entities;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class Evaluation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer etoiles; // 1 à 5
    private String commentaire;

    @ManyToOne
    @JoinColumn(name = "etudiant_id")
    @JsonBackReference(value = "etudiant-evaluations")
    private Etudiant auteur;

    @ManyToOne
    @JoinColumn(name = "cours_id")
    @JsonBackReference(value = "cours-evaluations")
    private Cours cours;

    // Getters et Setters
}