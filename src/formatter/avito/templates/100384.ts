import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100384 — «Сапоги» (женская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100384,
  nodeName: "Сапоги",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Сапоги"],
});
