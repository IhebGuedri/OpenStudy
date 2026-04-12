package org.example.openstudy.security;

import org.example.openstudy.Repository.EtudiantRepo;
import org.example.openstudy.entities.Etudiant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

class LoginRequest {
    private String email;
    private String password;

    public LoginRequest() {
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}

class RegisterRequest {
    private String nom;
    private String email;
    private String password;

    public RegisterRequest() {
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}


@RestController
@RequestMapping("/auth")
public class SecurityController {

    private final EtudiantRepo etudiantRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    @Value("${app.admin.email:admin@openstudy.local}")
    private String adminEmail;

    public SecurityController(EtudiantRepo etudiantRepo, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder) {
        this.etudiantRepo = etudiantRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
    }

    @GetMapping("/profile")
    public Authentication authentication(Authentication authentication) {
        return authentication;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody RegisterRequest request) {
        if (request.getEmail() == null || request.getPassword() == null || request.getNom() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nom, email et mot de passe sont requis");
        }

        if (etudiantRepo.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un compte existe deja avec cet email");
        }

        Etudiant saved = etudiantRepo.save(
                Etudiant.builder()
                        .nom(request.getNom())
                        .email(request.getEmail())
                        .motDePasse(passwordEncoder.encode(request.getPassword()))
                        .build()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", saved.getId(),
                "nom", saved.getNom(),
                "email", saved.getEmail()
        ));
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest request) {
        if (request.getEmail() == null || request.getPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email et mot de passe sont requis");
        }

        Etudiant etudiant = etudiantRepo.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email invalide"));

        if (!passwordEncoder.matches(request.getPassword(), etudiant.getMotDePasse())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Mot de passe invalide");
        }

        Instant instant = Instant.now();

        String scope = etudiant.getEmail().equalsIgnoreCase(adminEmail) ? "USER ADMIN" : "USER";

        JwtClaimsSet jwtClaimsSet = JwtClaimsSet.builder()
                .subject(etudiant.getEmail())
                .issuedAt(instant)
            .expiresAt(instant.plus(12, ChronoUnit.HOURS))
                .claim("scope", scope)
                .claim("etudiantId", etudiant.getId())
                .build();

        JwtEncoderParameters jwtEncoderParameters =
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        jwtClaimsSet
                );

        String jwt = jwtEncoder.encode(jwtEncoderParameters).getTokenValue();

    return Map.of(
        "accessToken", jwt,
        "tokenType", "Bearer",
        "etudiantId", etudiant.getId(),
        "email", etudiant.getEmail(),
        "nom", etudiant.getNom()
    );
    }
}
