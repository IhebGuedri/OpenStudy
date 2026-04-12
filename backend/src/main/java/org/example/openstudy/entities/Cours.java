package org.example.openstudy.entities;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class Cours {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String titre;

    @Enumerated(EnumType.STRING)
    private Visibilite visibilite;

    @ManyToOne
    @JoinColumn(name = "etudiant_id")
    @JsonBackReference
    private Etudiant proprietaire;

    @OneToMany(mappedBy = "cours", cascade = CascadeType.ALL)
    @JsonManagedReference
    private List<Chapitre> chapitres;

    // Relation vers le résumé
    @OneToOne(mappedBy = "cours", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonManagedReference(value = "cours-resume")
    private Resume resume;

    @OneToMany(mappedBy = "cours")
    @JsonManagedReference(value = "cours-evaluations")
    private List<Evaluation> evaluations;


    // Getters and Setters
}