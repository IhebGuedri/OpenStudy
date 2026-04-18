package org.example.openstudy.web;

import org.example.openstudy.Repository.CoursRepo;
import org.example.openstudy.Repository.ResumeRepo;
import org.example.openstudy.entities.Cours;
import org.example.openstudy.entities.Resume;
import org.example.openstudy.security.AccessControlService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

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

    @GetMapping("/etudiant/{etudiantId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public List<ResumeDto> getMesResumes(@PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        return resumeRepo.findAllByEtudiantId(etudiantId).stream().map(this::toDto).toList();
    }

    @GetMapping("/{resumeId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public ResumeDto getResumeById(@PathVariable Long resumeId, Authentication authentication) {
        Resume resume = resumeRepo.findById(resumeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Résumé introuvable"));
        accessControlService.requireCourseOwnerOrAdmin(resume.getCours(), authentication);
        return toDto(resume);
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

    @PostMapping("/cours/{coursId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public ResumeDto saveResumeForCourse(@PathVariable Long coursId, @RequestBody ResumeUpsertRequest request, Authentication authentication) {
        Cours cours = coursRepo.findById(coursId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);

        String contenu = request.contenu() == null ? "" : request.contenu().trim();
        if (contenu.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le contenu du résumé est obligatoire");
        }

        Resume resume = cours.getResume();
        boolean isNewResume = resume == null;
        if (resume == null) {
            resume = new Resume();
            resume.setCours(cours);
            resume.setDateCreation(LocalDateTime.now());
        }

        resume.setContenu(contenu);
        resume.setVersionIA(request.versionIA() == null || request.versionIA().trim().isEmpty()
                ? "openStudy-ai-agent"
                : request.versionIA().trim());

        if (isNewResume && resume.getDateCreation() == null) {
            resume.setDateCreation(LocalDateTime.now());
        }

        Resume saved = resumeRepo.save(resume);
        return toDto(saved);
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
    public ResumeDto getResumeByCours(@PathVariable Long coursId, Authentication authentication) {
        Cours cours = coursRepo.findById(coursId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);
        if (cours.getResume() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Résumé introuvable");
        }
        return toDto(cours.getResume());
    }

    private ResumeDto toDto(Resume resume) {
        return new ResumeDto(
                resume.getId(),
                resume.getCours() != null ? resume.getCours().getId() : null,
                resume.getCours() != null ? resume.getCours().getTitre() : null,
                resume.getContenu(),
                resume.getDateCreation() != null ? resume.getDateCreation().toString() : null,
                resume.getVersionIA()
        );
    }

    public record ResumeUpsertRequest(String contenu, String versionIA) {}
    public record ResumeDto(Long id, Long coursId, String coursTitre, String contenu, String dateCreation, String versionIA) {}
}