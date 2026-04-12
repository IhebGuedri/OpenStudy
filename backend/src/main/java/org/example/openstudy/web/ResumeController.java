package org.example.openstudy.web;

import org.example.openstudy.Repository.CoursRepo;
import org.example.openstudy.Repository.ResumeRepo;
import org.example.openstudy.entities.Cours;
import org.example.openstudy.entities.Resume;
import org.example.openstudy.security.AccessControlService;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/resumes")
@CrossOrigin("*")
public class ResumeController {

    private final CoursRepo coursRepo;
    private final ResumeRepo resumeRepo;
    private final AccessControlService accessControlService;

    public ResumeController(CoursRepo coursRepo, ResumeRepo resumeRepo, AccessControlService accessControlService) {
        this.coursRepo = coursRepo;
        this.resumeRepo = resumeRepo;
        this.accessControlService = accessControlService;
    }

    // Créer un résumé pour un cours
    @PostMapping("/create/{coursId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Resume createResume(@PathVariable Long coursId, Authentication authentication) {
        Cours cours = coursRepo.findById(coursId).orElseThrow();
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);

        Resume resume = new Resume();
        resume.setCours(cours);
        resume.setDateCreation(java.time.LocalDateTime.now());

        return resumeRepo.save(resume);
    }

    // Mettre à jour le contenu d'un résumé
    @PutMapping("/update/{resumeId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Resume updateResume(@PathVariable Long resumeId, @RequestBody String newContenu, Authentication authentication) {
        Resume resume = resumeRepo.findById(resumeId).orElseThrow();
        accessControlService.requireCourseOwnerOrAdmin(resume.getCours(), authentication);
        resume.setContenu(newContenu);
        return resumeRepo.save(resume);
    }

    // Récupérer le résumé d'un cours
    @GetMapping("/cours/{coursId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Resume getResumeByCours(@PathVariable Long coursId, Authentication authentication) {
        Cours cours = coursRepo.findById(coursId).orElseThrow();
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);
        return cours.getResume();
    }
}