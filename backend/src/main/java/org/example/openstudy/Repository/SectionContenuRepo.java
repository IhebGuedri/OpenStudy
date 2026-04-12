package org.example.openstudy.Repository;

import org.example.openstudy.entities.SectionContenu;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SectionContenuRepo extends JpaRepository<SectionContenu, Long> {
    List<SectionContenu> findByChapitreId(Long chapitreId);
}
