import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100374 — «Спортивная обувь» (мужская обувь).
 *
 * Utility-template: в schema-доке Avito ColorName отсутствует, Color
 * помечен optional. Эмпирически (см. xmlcheck/-валидатор) Avito пропускает
 * sneakers-XML с тегом ColorName для этого template'а — отдельный builder
 * не требуется. Подробности — docs/avito-templates-audit.md в export-api.
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100374,
  nodeName: "Спортивная обувь",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Спортивная обувь"],
  utilityShoes: true,
});
