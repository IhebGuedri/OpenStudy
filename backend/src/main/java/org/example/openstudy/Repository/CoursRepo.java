package org.example.openstudy.Repository;

import org.example.openstudy.entities.Cours;
import org.example.openstudy.entities.Visibilite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoursRepo extends JpaRepository<Cours, Long> {
    List<Cours> findByVisibilite(Visibilite visibilite);
    List<Cours> findByProprietaireId(Long etudiantId);
    Cours findByIdAndProprietaireId(Long coursId, Long etudiantId);
    Cours findByIdAndVisibilite(Long coursId, Visibilite visibilite);
}
