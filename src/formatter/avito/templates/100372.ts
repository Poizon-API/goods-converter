import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100372 — «Сапоги и полусапоги» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100372,
  nodeName: "Сапоги и полусапоги",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Сапоги и полусапоги"],
});
