package org.example.openstudy.entities;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class Etudiant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String motDePasse;

    @OneToMany(mappedBy = "proprietaire", cascade = CascadeType.ALL)
    @JsonManagedReference
    private List<Cours> mesCours;

    @OneToMany(mappedBy = "auteur")
    @JsonManagedReference(value = "etudiant-evaluations")
    private List<Evaluation> mesEvaluations;


}

