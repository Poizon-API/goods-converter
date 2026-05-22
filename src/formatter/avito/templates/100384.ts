import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100384.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100384 — «Сапоги» (женская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100384,
  nodeName: "Сапоги",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Сапоги"],
  sizeValues: snapshot.externalValues.Size,
});
