package org.example.openstudy.security;

import org.example.openstudy.Repository.EtudiantRepo;
import org.example.openstudy.entities.Etudiant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AdminBootstrapConfig {

    @Bean
    CommandLineRunner ensureAdminAccount(
            EtudiantRepo etudiantRepo,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.enabled:true}") boolean adminEnabled,
            @Value("${app.admin.name:System Admin}") String adminName,
            @Value("${app.admin.email:admin@openstudy.local}") String adminEmail,
            @Value("${app.admin.password:admin123}") String adminPassword
    ) {
        return args -> {
            if (!adminEnabled || etudiantRepo.existsByEmail(adminEmail)) {
                return;
            }

            Etudiant admin = Etudiant.builder()
                    .nom(adminName)
                    .email(adminEmail)
                    .motDePasse(passwordEncoder.encode(adminPassword))
                    .build();

            etudiantRepo.save(admin);
            System.out.println("Admin account created: " + adminEmail);
        };
    }
}
