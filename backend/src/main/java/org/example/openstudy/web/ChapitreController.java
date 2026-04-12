package org.example.openstudy.web;

import org.example.openstudy.Repository.ChapitreRepo;
import org.example.openstudy.Repository.CoursRepo;
import org.example.openstudy.entities.Chapitre;
import org.example.openstudy.entities.Cours;
import org.example.openstudy.entities.TypeContenu;
import org.example.openstudy.security.AccessControlService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;



@RestController
@RequestMapping("/chapitres")
@CrossOrigin("*")
public class ChapitreController {

    private final ChapitreRepo chapitreRepo;
    private final CoursRepo coursRepo;
    private final AccessControlService accessControlService;

    public ChapitreController(ChapitreRepo chapitreRepo, CoursRepo coursRepo, AccessControlService accessControlService) {
        this.chapitreRepo = chapitreRepo;
        this.coursRepo = coursRepo;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/cours/{coursId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public List<ChapitreDto> getChapitresByCours(@PathVariable Long coursId, Authentication authentication) {
        Cours cours = coursRepo.findById(coursId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);

        return chapitreRepo.findByCoursIdOrderByOrdreAsc(coursId)
                .stream()
            .map(chapitre -> new ChapitreDto(
                chapitre.getId(),
                chapitre.getTitre(),
                chapitre.getOrdre(),
                chapitre.getSections() == null
                    ? List.of()
                    : chapitre.getSections().stream()
                    .map(section -> new SectionContenuDto(
                        section.getId(),
                        section.getContenu(),
                        section.getType(),
                        section.getDateAjout(),
                        section.getPromptSource()))
                    .toList()))
                .toList();
    }

        public record ChapitreDto(Long id, String titre, Integer ordre, List<SectionContenuDto> sections) {}

        public record SectionContenuDto(Long id,
                        String contenu,
                        TypeContenu type,
                        LocalDateTime dateAjout,
                        String promptSource) {}

    // Add a new chapter to a course
    @PostMapping("/add/{coursId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Chapitre addChapitre(@PathVariable Long coursId, @RequestBody Chapitre chapitre, Authentication authentication) {
        Cours cours = coursRepo.findById(coursId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));

        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);

        if (chapitre == null || chapitre.getTitre() == null || chapitre.getTitre().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Titre du chapitre obligatoire");
        }

        // Ensure a clean create payload and prevent accidental cascade writes from client-provided sections.
        chapitre.setId(null);
        chapitre.setSections(null);
        chapitre.setTitre(chapitre.getTitre().trim());
        chapitre.setCours(cours);

        try {
            return chapitreRepo.save(chapitre);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Impossible d'ajouter le chapitre", e);
        }
    }

    // Update chapter details
    @PutMapping("/update/{id}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Chapitre updateChapitre(@PathVariable Long id, @RequestBody Chapitre chapitreDetails, Authentication authentication) {
        Chapitre chapitre = chapitreRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chapitre introuvable"));

        accessControlService.requireCourseOwnerOrAdmin(chapitre.getCours(), authentication);
        
        chapitre.setTitre(chapitreDetails.getTitre());
        chapitre.setOrdre(chapitreDetails.getOrdre());
        
        return chapitreRepo.save(chapitre);
    }

    // Delete a chapter
    @DeleteMapping("/delete/{id}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public void deleteChapitre(@PathVariable Long id, Authentication authentication) {
        Chapitre chapitre = chapitreRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chapitre introuvable"));
        accessControlService.requireCourseOwnerOrAdmin(chapitre.getCours(), authentication);
        chapitreRepo.deleteById(id);
    }
}