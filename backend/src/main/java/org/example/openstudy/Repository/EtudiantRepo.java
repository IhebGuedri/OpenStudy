package org.example.openstudy.Repository;

import org.example.openstudy.entities.Etudiant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EtudiantRepo extends JpaRepository<Etudiant, Long> {
	Optional<Etudiant> findByEmail(String email);
	boolean existsByEmail(String email);
}
