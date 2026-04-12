package org.example.openstudy.web;

import org.example.openstudy.Repository.ChapitreRepo;
import org.example.openstudy.Repository.SectionContenuRepo;
import org.example.openstudy.entities.Chapitre;
import org.example.openstudy.entities.SectionContenu;
import org.example.openstudy.security.AccessControlService;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/sections")
@CrossOrigin("*")
public class SectionController {

    private final SectionContenuRepo sectionRepo;
    private final ChapitreRepo chapitreRepo;
    private final AccessControlService accessControlService;

    public SectionController(SectionContenuRepo sectionRepo, ChapitreRepo chapitreRepo, AccessControlService accessControlService) {
        this.sectionRepo = sectionRepo;
        this.chapitreRepo = chapitreRepo;
        this.accessControlService = accessControlService;
    }

    // Add a section to a specific chapter
    @PostMapping("/add/{chapitreId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public SectionContenu addSection(@PathVariable Long chapitreId, @RequestBody SectionContenu section, Authentication authentication) {
        return chapitreRepo.findById(chapitreId).map(chapitre -> {
            accessControlService.requireCourseOwnerOrAdmin(chapitre.getCours(), authentication);
            section.setChapitre(chapitre);
            section.setDateAjout(java.time.LocalDateTime.now());
            return sectionRepo.save(section);
        }).orElseThrow(() -> new RuntimeException("Chapitre not found"));
    }

    // Get all sections for a chapter
    @GetMapping("/chapitre/{chapitreId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public List<SectionContenu> getByChapitre(@PathVariable Long chapitreId, Authentication authentication) {
        Chapitre chapitre = chapitreRepo.findById(chapitreId).orElseThrow(() -> new RuntimeException("Chapitre not found"));
        accessControlService.requireCourseOwnerOrAdmin(chapitre.getCours(), authentication);
        return sectionRepo.findByChapitreId(chapitreId);
    }

    // Delete a section
    @DeleteMapping("/delete/{id}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public void deleteSection(@PathVariable Long id, Authentication authentication) {
        SectionContenu section = sectionRepo.findById(id).orElseThrow(() -> new RuntimeException("Section not found"));
        accessControlService.requireCourseOwnerOrAdmin(section.getChapitre().getCours(), authentication);
        sectionRepo.deleteById(id);
    }

    // Update section content/type
    @PutMapping("/update/{id}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public SectionContenu updateSection(@PathVariable Long id, @RequestBody SectionContenu updatedSection, Authentication authentication) {
        SectionContenu existing = sectionRepo.findById(id).orElseThrow(() -> new RuntimeException("Section not found"));
        accessControlService.requireCourseOwnerOrAdmin(existing.getChapitre().getCours(), authentication);

        if (updatedSection.getContenu() != null) {
            existing.setContenu(updatedSection.getContenu());
        }
        if (updatedSection.getType() != null) {
            existing.setType(updatedSection.getType());
        }
        if (updatedSection.getPromptSource() != null) {
            existing.setPromptSource(updatedSection.getPromptSource());
        }

        return sectionRepo.save(existing);
    }
}