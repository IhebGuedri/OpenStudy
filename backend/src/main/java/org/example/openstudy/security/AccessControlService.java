package org.example.openstudy.security;

import org.example.openstudy.entities.Cours;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AccessControlService {

    public Long getAuthenticatedEtudiantId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur non authentifie");
        }

        Object claim = jwt.getClaim("etudiantId");
        if (claim instanceof Number number) {
            return number.longValue();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token invalide: etudiantId manquant");
    }

    public boolean isAdmin(Authentication authentication) {
        return authentication != null
                && authentication.getAuthorities().stream()
                .anyMatch(a -> "SCOPE_ADMIN".equals(a.getAuthority()));
    }

    public void requireSelfOrAdmin(Long requestedEtudiantId, Authentication authentication) {
        if (isAdmin(authentication)) {
            return;
        }

        Long authenticatedEtudiantId = getAuthenticatedEtudiantId(authentication);
        if (!authenticatedEtudiantId.equals(requestedEtudiantId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acces refuse a ce compte");
        }
    }

    public void requireCourseOwnerOrAdmin(Cours cours, Authentication authentication) {
        if (isAdmin(authentication)) {
            return;
        }

        Long authenticatedEtudiantId = getAuthenticatedEtudiantId(authentication);
        Long ownerId = cours.getProprietaire() != null ? cours.getProprietaire().getId() : null;

        if (ownerId == null || !ownerId.equals(authenticatedEtudiantId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acces refuse a ce cours prive");
        }
    }
}
