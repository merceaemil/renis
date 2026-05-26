import type { Catalog, Locale } from "./i18n";
import { translate } from "./i18n";

/**
 * Catalog for strings emitted by HTTP responses (errors, verification result
 * messages, etc). Keep keys stable; UI / consumers may match on them.
 */
export const apiMessages: Catalog = {
  en: {
    "api.error.unauthorized": "Unauthorized",
    "api.error.forbidden": "Forbidden",
    "api.error.notFound": "Not found",
    "api.error.badRequest": "Invalid request",
    "api.error.invalidPayload": "Invalid payload",
    "api.error.serverError": "Server error",
    "api.error.tooManyRequests": "Too many requests",
    "api.error.creationFailed": "Creation failed",
    "api.error.updateFailed": "Update failed",
    "api.error.deletionFailed": "Deletion failed",

    "api.users.cannotCreateRole":
      "You cannot create an account with this role.",
    "api.users.institutionRequired":
      "An institution is required for an institution admin.",
    "api.users.emailExists": "An account with this email already exists.",
    "api.users.cannotDeactivateSelf":
      "You cannot deactivate your own account.",

    "api.students.idExists": "Student ID already exists.",
    "api.students.notFound": "Student not found",

    "api.programmes.codeExists": "Programme code already exists.",
    "api.programmes.notFound": "Programme not found",

    "api.institutions.codeExists": "Institution code already exists.",

    "api.gradeSessions.notEditable": "Session is not editable.",
    "api.gradeSessions.alreadySubmitted": "Session already submitted.",
    "api.gradeSessions.atLeastOneGrade":
      "Enter at least one grade before submitting.",
    "api.gradeSessions.missingFile": "Missing file upload.",
    "api.gradeSessions.emptySpreadsheet": "Empty spreadsheet.",
    "api.gradeSessions.invalidStudentOrSubject":
      "Invalid student or subject.",

    "api.enrollments.studentsNotFound": "One or more students not found.",
    "api.enrollments.studentIdRequired": "studentId query required",

    "api.diplomas.pdfRequired": "PDF file is required.",
    "api.diplomas.pdfNotAvailable": "PDF not available",
    "api.diplomas.downloadLinkFailed": "Could not generate download link",
    "api.diplomas.onlyDraftCanEdit": "Only draft diplomas can be edited.",
    "api.diplomas.codeMissing":
      "Verification code missing. Re-submit the diploma.",
    "api.diplomas.onlyDraftCanSubmit": "Only draft diplomas can be submitted.",
    "api.diplomas.onlyPublishedCanRevoke":
      "Only published diplomas can be revoked.",
    "api.diplomas.passwordFailed": "Password confirmation failed.",
    "api.diplomas.noPublishedHash": "No published PDF hash on record.",

    "api.gradeSessions.notSubmittedOrNotFound":
      "Session not found or not submitted.",
    "api.gradeSessions.missingStudentColumn":
      "Missing column: student_id_number",
    "api.gradeSessions.noSubjectColumns":
      "No subject columns matched programme subjects.",

    "api.branding.fileRequired": "file is required",
    "api.branding.maxFileSize": "Max file size 2 MB",
    "api.branding.invalidImageType": "Use PNG, JPEG, or WebP images.",
    "api.branding.invalidAsset":
      "asset must be logo, signature-institution, or signature-ministry",

    "api.error.institutionIdRequired":
      "institutionId is required for this action.",

    "api.classifications.invalidBand": "Each band must have min ≤ max.",
    "api.classifications.overlappingBands":
      "Classification bands must not overlap.",

    "api.verify.empty": "Please enter a verification code.",
    "api.verify.unknownTranscript":
      "No transcript matches this code. Please check your entry.",
    "api.verify.unknownDiploma":
      "No diploma matches this code. Please check your entry.",
    "api.verify.unknownAny":
      "No diploma or transcript matches this code. Please check your entry.",
  },
  fr: {
    "api.error.unauthorized": "Non autorisé",
    "api.error.forbidden": "Accès refusé",
    "api.error.notFound": "Introuvable",
    "api.error.badRequest": "Requête invalide",
    "api.error.invalidPayload": "Données invalides",
    "api.error.serverError": "Erreur serveur",
    "api.error.tooManyRequests": "Trop de requêtes",
    "api.error.creationFailed": "Échec de la création",
    "api.error.updateFailed": "Échec de la mise à jour",
    "api.error.deletionFailed": "Échec de la suppression",

    "api.users.cannotCreateRole":
      "Vous ne pouvez pas créer un compte avec ce rôle.",
    "api.users.institutionRequired":
      "Une institution est requise pour un administrateur d'institution.",
    "api.users.emailExists": "Un compte avec cet e-mail existe déjà.",
    "api.users.cannotDeactivateSelf":
      "Vous ne pouvez pas désactiver votre propre compte.",

    "api.students.idExists": "L'identifiant étudiant existe déjà.",
    "api.students.notFound": "Étudiant introuvable",

    "api.programmes.codeExists": "Le code du programme existe déjà.",
    "api.programmes.notFound": "Programme introuvable",

    "api.institutions.codeExists": "Le code de l'institution existe déjà.",

    "api.gradeSessions.notEditable": "La session n'est pas modifiable.",
    "api.gradeSessions.alreadySubmitted": "Session déjà soumise.",
    "api.gradeSessions.atLeastOneGrade":
      "Saisissez au moins une note avant de soumettre.",
    "api.gradeSessions.missingFile": "Fichier manquant.",
    "api.gradeSessions.emptySpreadsheet": "Feuille de calcul vide.",
    "api.gradeSessions.invalidStudentOrSubject":
      "Étudiant ou matière invalide.",

    "api.enrollments.studentsNotFound":
      "Un ou plusieurs étudiants sont introuvables.",
    "api.enrollments.studentIdRequired":
      "Le paramètre studentId est requis",

    "api.diplomas.pdfRequired": "Le fichier PDF est requis.",
    "api.diplomas.pdfNotAvailable": "PDF indisponible",
    "api.diplomas.downloadLinkFailed":
      "Impossible de générer le lien de téléchargement",
    "api.diplomas.onlyDraftCanEdit":
      "Seuls les diplômes en brouillon peuvent être modifiés.",
    "api.diplomas.codeMissing":
      "Code de vérification manquant. Veuillez soumettre à nouveau le diplôme.",
    "api.diplomas.onlyDraftCanSubmit":
      "Seuls les diplômes en brouillon peuvent être soumis.",
    "api.diplomas.onlyPublishedCanRevoke":
      "Seuls les diplômes publiés peuvent être révoqués.",
    "api.diplomas.passwordFailed":
      "Échec de la confirmation du mot de passe.",
    "api.diplomas.noPublishedHash":
      "Aucun hachage PDF publié enregistré.",

    "api.gradeSessions.notSubmittedOrNotFound":
      "Session introuvable ou non soumise.",
    "api.gradeSessions.missingStudentColumn":
      "Colonne manquante : student_id_number",
    "api.gradeSessions.noSubjectColumns":
      "Aucune colonne de matière ne correspond aux matières du programme.",

    "api.branding.fileRequired": "Le fichier est requis",
    "api.branding.maxFileSize": "Taille max du fichier : 2 Mo",
    "api.branding.invalidImageType":
      "Utilisez des images PNG, JPEG ou WebP.",
    "api.branding.invalidAsset":
      "L’asset doit être logo, signature-institution ou signature-ministry",

    "api.error.institutionIdRequired":
      "Le paramètre institutionId est requis pour cette action.",

    "api.classifications.invalidBand":
      "Chaque tranche doit avoir min ≤ max.",
    "api.classifications.overlappingBands":
      "Les tranches de classification ne doivent pas se chevaucher.",

    "api.verify.empty": "Veuillez saisir un code de vérification.",
    "api.verify.unknownTranscript":
      "Aucun relevé ne correspond à ce code. Veuillez vérifier votre saisie.",
    "api.verify.unknownDiploma":
      "Aucun diplôme ne correspond à ce code. Veuillez vérifier votre saisie.",
    "api.verify.unknownAny":
      "Aucun diplôme ou relevé ne correspond à ce code. Veuillez vérifier votre saisie.",
  },
};

export function tApi(
  key: string,
  locale: Locale = "en",
  vars?: Record<string, string | number>
): string {
  return translate(apiMessages, key, locale, vars);
}
