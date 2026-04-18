package org.example.openstudy.Repository;

import org.example.openstudy.entities.Resume;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResumeRepo extends JpaRepository<Resume, Long> {
	@Query("select r from Resume r where r.cours.proprietaire.id = :etudiantId order by r.dateCreation desc")
	List<Resume> findAllByEtudiantId(@Param("etudiantId") Long etudiantId);
}
