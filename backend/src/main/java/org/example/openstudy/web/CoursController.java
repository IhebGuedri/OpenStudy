package org.example.openstudy.web;

import org.example.openstudy.Repository.CoursRepo;
import org.example.openstudy.Repository.EtudiantRepo;
import org.example.openstudy.Repository.ChapitreRepo;
import org.example.openstudy.entities.Cours;
import org.example.openstudy.entities.Chapitre;
import org.example.openstudy.entities.Etudiant;
import org.example.openstudy.entities.Visibilite;
import org.example.openstudy.security.AccessControlService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/cours")
@CrossOrigin("*")
public class CoursController {

    private final CoursRepo coursRepo;
    private final EtudiantRepo etudiantRepo;
    private final ChapitreRepo chapitreRepo;
    private final AccessControlService accessControlService;

    public CoursController(CoursRepo coursRepo, EtudiantRepo etudiantRepo, ChapitreRepo chapitreRepo, AccessControlService accessControlService) {
        this.coursRepo = coursRepo;
        this.etudiantRepo = etudiantRepo;
        this.chapitreRepo = chapitreRepo;
        this.accessControlService = accessControlService;
    }

    // Mes cours
    @GetMapping("/etudiant/{etudiantId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public List<Cours> getMesCours(@PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        return coursRepo.findByProprietaireId(etudiantId);
    }

    @GetMapping("/titre/{etudiantId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public List<CoursTitreDto> getMesCoursTitle(@PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        return coursRepo.findByProprietaireId(etudiantId)
                .stream()
                .map(cours -> new CoursTitreDto(cours.getId(), cours.getTitre()))
                .toList();
    }

    public record CoursTitreDto(Long id, String titre) {}

    // Cours par id pour un etudiant
    @GetMapping("/{id}/etudiant/{etudiantId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Cours getCoursById(@PathVariable Long id, @PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        Cours cours = coursRepo.findByIdAndProprietaireId(id, etudiantId);
        if (cours == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable");
        }
        return cours;
    }

    // Ajouter un cours pour un etudiant
    @PostMapping("/add/{etudiantId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Cours addCours(@PathVariable Long etudiantId, @RequestBody Cours cours, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        Etudiant etudiant = etudiantRepo.findById(etudiantId).orElseThrow();
        cours.setProprietaire(etudiant);
        return coursRepo.save(cours);
    }

    @PutMapping("/update/{id}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Cours updateCours(@PathVariable Long id, @RequestBody CoursUpdateDto request, Authentication authentication) {
        Cours cours = coursRepo.findById(id).orElseThrow();
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);

        if (request.titre() != null && !request.titre().trim().isEmpty()) {
            cours.setTitre(request.titre().trim());
        }
        
        if (request.visibilite() != null) {
            try {
                cours.setVisibilite(Visibilite.valueOf(request.visibilite().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Visibilité invalide");
            }
        }

        return coursRepo.save(cours);
    }

    public record CoursUpdateDto(String titre, String visibilite) {}

    

    // Supprimer un cours
    @DeleteMapping("/delete/{id}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public void deleteCours(@PathVariable Long id, Authentication authentication) {
        Cours cours = coursRepo.findById(id).orElseThrow();
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);
        coursRepo.deleteById(id);
    }

    // Cours publics (accessible to everyone, no authentication required)
    @GetMapping("/public")
    public List<Cours> getPublicCourses() {
        return coursRepo.findByVisibilite(Visibilite.PUBLIC);
    }

    @GetMapping("/public/cards")
    public List<PublicCourseCardDto> getPublicCourseCards() {
        return coursRepo.findByVisibilite(Visibilite.PUBLIC)
                .stream()
                .map(cours -> new PublicCourseCardDto(
                        cours.getId(),
                        cours.getTitre(),
                        cours.getProprietaire() != null ? cours.getProprietaire().getNom() : "Inconnu"
                ))
                .toList();
    }

    @GetMapping("/public/{id}")
    public Cours getPublicCourseById(@PathVariable Long id) {
        Cours cours = coursRepo.findByIdAndVisibilite(id, Visibilite.PUBLIC);
        if (cours == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours public introuvable");
        }
        return cours;
    }

    // Rendre un cours public
    @PutMapping("/openPublic/{id}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Cours openPublic(@PathVariable Long id, Authentication authentication) {
        Cours cours = coursRepo.findById(id).orElseThrow();
        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);
        cours.setVisibilite(Visibilite.PUBLIC);
        return coursRepo.save(cours);
    }

    // Get course by ID (for checking visibility - no auth required but limited info)
    @GetMapping("/{id}")
    public CourseVisibilityDto getCourseInfo(@PathVariable Long id) {
        Cours cours = coursRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        return new CourseVisibilityDto(cours.getId(), cours.getTitre(), cours.getVisibilite().toString());
    }

    public record CourseVisibilityDto(Long id, String titre, String visibilite) {}
    public record PublicCourseCardDto(Long id, String titre, String ownerName) {}

    // Copier un cours public comme cours personnel
    @PostMapping("/copy/{publicCourseId}/etudiant/{etudiantId}")
    @PreAuthorize("hasAuthority('SCOPE_USER')")
    public Cours copyCourse(@PathVariable Long publicCourseId, @PathVariable Long etudiantId, 
                           @RequestBody CourseCopyDto request, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        
        // Get the public course to copy
        Cours publicCourse = coursRepo.findById(publicCourseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours source introuvable"));
        
        // Check if it's public
        if (publicCourse.getVisibilite() != Visibilite.PUBLIC) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce cours n'est pas public");
        }
        
        // Get the target student
        Etudiant etudiant = etudiantRepo.findById(etudiantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Étudiant introuvable"));
        
        // Create a new course
        Cours newCours = new Cours();
        newCours.setTitre(request.titre() != null && !request.titre().trim().isEmpty() 
                ? request.titre() 
                : publicCourse.getTitre() + " (Copie)");
        newCours.setProprietaire(etudiant);
        newCours.setVisibilite(Visibilite.PRIVE); // New copy is private by default
        
        // Save the new course first to get an ID
        Cours savedCours = coursRepo.save(newCours);
        
        // Copy chapters with their sections
        if (publicCourse.getChapitres() != null && !publicCourse.getChapitres().isEmpty()) {
            final Cours courseForLambda = savedCours; // Make final for use in lambda
            List<Chapitre> copiedChapitres = publicCourse.getChapitres().stream()
                    .map(chapitre -> copyChapitre(chapitre, courseForLambda))
                    .collect(Collectors.toList());
            savedCours.setChapitres(copiedChapitres);
            savedCours = coursRepo.save(savedCours);
        }
        
        return savedCours;
    }

    private Chapitre copyChapitre(Chapitre original, Cours targetCours) {
        Chapitre newChapitre = new Chapitre();
        newChapitre.setTitre(original.getTitre());
        newChapitre.setOrdre(original.getOrdre());
        newChapitre.setCours(targetCours);
        
        // Sections will be copied via cascade (if needed)
        if (original.getSections() != null && !original.getSections().isEmpty()) {
            newChapitre.setSections(original.getSections().stream()
                    .map(section -> copySectionContenu(section, newChapitre))
                    .collect(Collectors.toList()));
        }
        
        return newChapitre;
    }

    private org.example.openstudy.entities.SectionContenu copySectionContenu(
            org.example.openstudy.entities.SectionContenu original, Chapitre targetChapitre) {
        org.example.openstudy.entities.SectionContenu newSection = new org.example.openstudy.entities.SectionContenu();
        newSection.setContenu(original.getContenu());
        newSection.setType(original.getType());
        newSection.setDateAjout(original.getDateAjout());
        newSection.setPromptSource(original.getPromptSource());
        newSection.setChapitre(targetChapitre);
        
        return newSection;
    }

    public record CourseCopyDto(String titre) {}
}

