package org.example.openstudy.Repository;

import org.example.openstudy.entities.Resume;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResumeRepo extends JpaRepository<Resume, Long> {
}
