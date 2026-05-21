import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100389 — «Полусапоги» (женская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100389,
  nodeName: "Полусапоги",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Полусапоги"],
});
