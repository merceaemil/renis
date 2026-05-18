import { diplomaObjectKey, putObject, sha256Buffer } from "@renis/core";
import { DiplomaStatus, prisma } from "@renis/database";
import { buildDiplomaPdfBuffer } from "@/lib/diploma-pdf";

export async function publishDiplomaPdf(diplomaId: string) {
  const { pdf, diploma } = await buildDiplomaPdfBuffer(diplomaId);
  if (!diploma.uniqueCode) {
    throw new Error("Diploma has no verification code");
  }

  const pdfHash = sha256Buffer(pdf);
  const pdfPath = diplomaObjectKey({
    institutionId: diploma.institutionId,
    graduationYear: diploma.graduationYear,
    uniqueCode: diploma.uniqueCode,
  });

  await putObject({
    key: pdfPath,
    body: pdf,
    contentType: "application/pdf",
  });

  return prisma.diploma.update({
    where: { id: diplomaId },
    data: {
      status: DiplomaStatus.PUBLISHED,
      publishedAt: new Date(),
      pdfPath,
      pdfHash,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentIdNumber: true,
        },
      },
    },
  });
}
