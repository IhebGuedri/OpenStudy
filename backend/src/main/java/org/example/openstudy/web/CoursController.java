package org.example.openstudy.web;

import org.example.openstudy.Repository.CoursRepo;
import org.example.openstudy.Repository.EtudiantRepo;
import org.example.openstudy.Repository.ChapitreRepo;
import org.example.openstudy.Repository.CoursStarRepo;
import org.example.openstudy.entities.Cours;
import org.example.openstudy.entities.CoursStar;
import org.example.openstudy.entities.Chapitre;
import org.example.openstudy.entities.Etudiant;
import org.example.openstudy.entities.Visibilite;
import org.example.openstudy.security.AccessControlService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/cours")
@CrossOrigin("*")
public class CoursController {

    private final CoursRepo coursRepo;
    private final EtudiantRepo etudiantRepo;
    private final ChapitreRepo chapitreRepo;
    private final CoursStarRepo coursStarRepo;
    private final AccessControlService accessControlService;

    public CoursController(
            CoursRepo coursRepo,
            EtudiantRepo etudiantRepo,
            ChapitreRepo chapitreRepo,
            CoursStarRepo coursStarRepo,
            AccessControlService accessControlService
    ) {
        this.coursRepo = coursRepo;
        this.etudiantRepo = etudiantRepo;
        this.chapitreRepo = chapitreRepo;
        this.coursStarRepo = coursStarRepo;
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
            .map(cours -> buildPublicCard(cours, null))
                .toList();
    }

        @GetMapping("/cards/public/etudiant/{etudiantId}")
        @PreAuthorize("hasAuthority('SCOPE_USER')")
        public List<PublicCourseCardDto> getPublicCourseCardsForEtudiant(@PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        return coursRepo.findByVisibilite(Visibilite.PUBLIC)
            .stream()
            .map(cours -> buildPublicCard(cours, etudiantId))
            .toList();
        }

        @GetMapping("/etudiant/{etudiantId}/cards")
        @PreAuthorize("hasAuthority('SCOPE_USER')")
        public List<MyCourseCardDto> getMesCoursCards(@PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        return coursRepo.findByProprietaireId(etudiantId)
            .stream()
            .map(cours -> buildMyCard(cours, etudiantId))
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

        @PutMapping("/{coursId}/stars/etudiant/{etudiantId}")
        @PreAuthorize("hasAuthority('SCOPE_USER')")
        public StarActionDto addStar(@PathVariable Long coursId, @PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);

        Cours cours = coursRepo.findById(coursId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        assertCourseCanBeStarredByUser(cours, authentication);

        Etudiant etudiant = etudiantRepo.findById(etudiantId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Étudiant introuvable"));

        if (!coursStarRepo.existsByCoursIdAndEtudiantId(coursId, etudiantId)) {
            CoursStar star = new CoursStar();
            star.setCours(cours);
            star.setEtudiant(etudiant);
            star.setCreatedAt(LocalDateTime.now());
            coursStarRepo.save(star);
        }

        long starsCount = coursStarRepo.countByCoursId(coursId);
        String ownerName = cours.getProprietaire() != null ? cours.getProprietaire().getNom() : "Inconnu";
        return new StarActionDto(true, starsCount, cours.getId(), cours.getTitre(), ownerName, etudiant.getNom());
        }

        @DeleteMapping("/{coursId}/stars/etudiant/{etudiantId}")
        @PreAuthorize("hasAuthority('SCOPE_USER')")
        public StarActionDto removeStar(@PathVariable Long coursId, @PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);

        Cours cours = coursRepo.findById(coursId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        assertCourseCanBeStarredByUser(cours, authentication);

        Etudiant etudiant = etudiantRepo.findById(etudiantId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Étudiant introuvable"));

        coursStarRepo.findByCoursIdAndEtudiantId(coursId, etudiantId)
            .ifPresent(coursStarRepo::delete);

        long starsCount = coursStarRepo.countByCoursId(coursId);
        String ownerName = cours.getProprietaire() != null ? cours.getProprietaire().getNom() : "Inconnu";
        return new StarActionDto(false, starsCount, cours.getId(), cours.getTitre(), ownerName, etudiant.getNom());
        }

        @GetMapping("/{coursId}/stars/etudiant/{etudiantId}")
        @PreAuthorize("hasAuthority('SCOPE_USER')")
        public StarStatusDto getStarStatus(@PathVariable Long coursId, @PathVariable Long etudiantId, Authentication authentication) {
        accessControlService.requireSelfOrAdmin(etudiantId, authentication);
        Cours cours = coursRepo.findById(coursId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        assertCourseCanBeStarredByUser(cours, authentication);

        boolean starredByMe = coursStarRepo.existsByCoursIdAndEtudiantId(coursId, etudiantId);
        long starsCount = coursStarRepo.countByCoursId(coursId);
        return new StarStatusDto(coursId, starredByMe, starsCount);
        }

    // Get course by ID (for checking visibility - no auth required but limited info)
    @GetMapping("/{id}")
    public CourseVisibilityDto getCourseInfo(@PathVariable Long id) {
        Cours cours = coursRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        return new CourseVisibilityDto(cours.getId(), cours.getTitre(), cours.getVisibilite().toString());
    }

    public record CourseVisibilityDto(Long id, String titre, String visibilite) {}
    public record PublicCourseCardDto(Long id, String titre, String ownerName, long starsCount, boolean starredByMe) {}
    public record MyCourseCardDto(Long id, String titre, int chaptersCount, long starsCount, boolean starredByMe, String latestStarBy, String latestStarAtIso) {}
    public record StarStatusDto(Long coursId, boolean starredByMe, long starsCount) {}
    public record StarActionDto(boolean starredByMe, long starsCount, Long coursId, String coursTitre, String ownerName, String starrerName) {}

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

    private PublicCourseCardDto buildPublicCard(Cours cours, Long currentEtudiantId) {
        long starsCount = coursStarRepo.countByCoursId(cours.getId());
        boolean starredByMe = currentEtudiantId != null
                && coursStarRepo.existsByCoursIdAndEtudiantId(cours.getId(), currentEtudiantId);
        String ownerName = cours.getProprietaire() != null ? cours.getProprietaire().getNom() : "Inconnu";
        return new PublicCourseCardDto(cours.getId(), cours.getTitre(), ownerName, starsCount, starredByMe);
    }

    private MyCourseCardDto buildMyCard(Cours cours, Long currentEtudiantId) {
        int chaptersCount = cours.getChapitres() != null ? cours.getChapitres().size() : 0;
        long starsCount = coursStarRepo.countByCoursId(cours.getId());
        boolean starredByMe = coursStarRepo.existsByCoursIdAndEtudiantId(cours.getId(), currentEtudiantId);
        Optional<CoursStar> latestStar = coursStarRepo.findTopByCoursIdOrderByCreatedAtDesc(cours.getId());
        String latestStarBy = latestStar.map(value -> value.getEtudiant().getNom()).orElse(null);
        String latestStarAtIso = latestStar
                .map(value -> value.getCreatedAt().atOffset(ZoneOffset.UTC).toString())
                .orElse(null);

        return new MyCourseCardDto(
                cours.getId(),
                cours.getTitre(),
                chaptersCount,
                starsCount,
                starredByMe,
                latestStarBy,
                latestStarAtIso
        );
    }

    private void assertCourseCanBeStarredByUser(Cours cours, Authentication authentication) {
        if (cours.getVisibilite() == Visibilite.PUBLIC) {
            return;
        }

        accessControlService.requireCourseOwnerOrAdmin(cours, authentication);
    }

    public record CourseCopyDto(String titre) {}
}

