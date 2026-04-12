package org.example.openstudy.web;

import org.example.openstudy.Repository.CoursRepo;
import org.example.openstudy.Repository.EtudiantRepo;
import org.example.openstudy.Repository.EvaluationRepo;
import org.example.openstudy.entities.Cours;
import org.example.openstudy.entities.Etudiant;
import org.example.openstudy.entities.Evaluation;
import org.example.openstudy.entities.Visibilite;
import org.example.openstudy.security.AccessControlService;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/evaluations")
@CrossOrigin("*")
public class EvaluationController {

    private final EvaluationRepo evaluationRepo;
    private final CoursRepo coursRepo;
    private final EtudiantRepo etudiantRepo;
    private final AccessControlService accessControlService;

    public EvaluationController(EvaluationRepo evaluationRepo, CoursRepo coursRepo, EtudiantRepo etudiantRepo, AccessControlService accessControlService) {
        this.evaluationRepo = evaluationRepo;
        this.coursRepo = coursRepo;
        this.etudiantRepo = etudiantRepo;
        this.accessControlService = accessControlService;
    }

    // Submit a review for a course
    @PostMapping("/submit/{coursId}/{etudiantId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Evaluation addEvaluation(
            @PathVariable Long coursId,
            @PathVariable Long etudiantId,
            Authentication authentication,
            @RequestBody Evaluation evaluation) {

        accessControlService.requireSelfOrAdmin(etudiantId, authentication);

        return coursRepo.findById(coursId).map(cours -> {
            if (cours.getVisibilite() == Visibilite.PRIVE) {
                accessControlService.requireCourseOwnerOrAdmin(cours, authentication);
            }

            Etudiant auteur = etudiantRepo.findById(etudiantId).orElseThrow();

            evaluation.setCours(cours);
            evaluation.setAuteur(auteur);

            return evaluationRepo.save(evaluation);
        }).orElseThrow(() -> new RuntimeException("Cours not found"));
    }

    // Get all evaluations for a specific course
    @GetMapping("/cours/{coursId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public List<Evaluation> getByCours(@PathVariable Long coursId, Authentication authentication) {
        Cours cours = coursRepo.findById(coursId).orElseThrow(() -> new RuntimeException("Cours not found"));
        if (cours.getVisibilite() == Visibilite.PRIVE) {
            accessControlService.requireCourseOwnerOrAdmin(cours, authentication);
        }
        return evaluationRepo.findByCoursId(coursId);
    }
}