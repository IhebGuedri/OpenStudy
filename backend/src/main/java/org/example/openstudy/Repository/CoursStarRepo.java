package org.example.openstudy.Repository;

import org.example.openstudy.entities.CoursStar;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CoursStarRepo extends JpaRepository<CoursStar, Long> {
    boolean existsByCoursIdAndEtudiantId(Long coursId, Long etudiantId);

    long countByCoursId(Long coursId);

    Optional<CoursStar> findByCoursIdAndEtudiantId(Long coursId, Long etudiantId);

    Optional<CoursStar> findTopByCoursIdOrderByCreatedAtDesc(Long coursId);

    List<CoursStar> findByCours_Proprietaire_IdOrderByCreatedAtDesc(Long proprietaireId);
}
