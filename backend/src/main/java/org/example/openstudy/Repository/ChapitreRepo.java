package org.example.openstudy.Repository;

import org.example.openstudy.entities.Chapitre;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChapitreRepo extends JpaRepository<Chapitre, Long> {
	List<Chapitre> findByCoursIdOrderByOrdreAsc(Long coursId);
}

