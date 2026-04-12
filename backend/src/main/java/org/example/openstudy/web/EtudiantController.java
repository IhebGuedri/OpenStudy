package org.example.openstudy.web;

import org.example.openstudy.Repository.EtudiantRepo;
import org.example.openstudy.entities.Etudiant;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/etudiants")
@CrossOrigin("*")
public class EtudiantController {

    private final EtudiantRepo etudiantRepo;

    public EtudiantController(EtudiantRepo etudiantRepo) {
        this.etudiantRepo = etudiantRepo;
    }

    // Ajouter un etudiant
    @PostMapping("/add")
    public Etudiant addEtudiant(@RequestBody Etudiant etudiant) {
        return etudiantRepo.save(etudiant);
    }

    // Supprimer un etudiant
    @DeleteMapping("/delete/{id}")
    @PreAuthorize("hasAuthority('SCOPE_ADMIN')") // Seuls les admins peuvent supprimer un étudiant
    public void deleteEtudiant(@PathVariable Long id) {
        etudiantRepo.deleteById(id);
    }

    // Lister tous les etudiants
    @GetMapping
    @PreAuthorize("hasAuthority('SCOPE_ADMIN')")
    public List<Etudiant> getAllEtudiants() {
        return etudiantRepo.findAll();
    }
}