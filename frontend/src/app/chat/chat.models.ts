export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Courstitre {
  id: number;
  titre: string;
}

export interface PublicCourseCard {
  id: number;
  titre: string;
  ownerName: string;
}

export interface ChapitreSummary {
  id: number;
  titre: string;
  ordre: number | null;
  sections: SectionContenuSummary[];
}

export interface SectionContenuSummary {
  id: number;
  contenu: string;
  type: 'TEXTE_GENERE' | 'EXPLICATION_IA' | 'NOTE_PERSONNELLE';
  dateAjout?: string;
  promptSource?: string;
}

export interface Cours {
  id: number;
  titre: string | null; // can be null if generated later
  visibilite: 'PUBLIC' | 'PRIVE'; // adjust if your enum differs
  proprietaire: Etudiant;
  chapitres: Chapitre[];
  resume: Resume | null;
  evaluations: Evaluation[];
}

export interface Etudiant {
  id: number;
  nom: string;
  email: string;
  motDePasse?: string; // usually not returned from backend for security

  mesCours?: Cours[];
  mesEvaluations?: Evaluation[];
}
export interface Evaluation {
  id: number;
  etoiles: number; // 1 to 5
  commentaire: string;

  auteur?: Etudiant;
  cours?: Cours;
}

export interface Resume {
  id: number;
  contenu: string;
  dateCreation: string; // LocalDateTime becomes string in JSON
  versionIA: string;

  cours?: Cours;
  coursId?: number;
  coursTitre?: string;
}


export interface Chapitre {
  id?: number;         // optional because it may not be set before saving
  titre: string;
  ordre: number;
  cours?: Cours;       // Many-to-One relationship
  sections?: SectionContenu[]; // One-to-Many relationship
}

export interface SectionContenu {
  id?: number;               // optional because it may not exist before saving
  contenu: string;
  type: "TEXTE_GENERE" | "EXPLICATION_IA" | "NOTE_PERSONNELLE"; // adjust as needed
  dateAjout?: string;        // ISO string, since LocalDateTime is not native in JS
  promptSource?: string;
  chapitre?: Chapitre;       // Many-to-One relationship
}