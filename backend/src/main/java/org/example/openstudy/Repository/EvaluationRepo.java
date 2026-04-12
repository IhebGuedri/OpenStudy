package org.example.openstudy.Repository;

import org.example.openstudy.entities.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EvaluationRepo extends JpaRepository<Evaluation, Long> {
    List<Evaluation> findByCoursId(Long coursId);
}
