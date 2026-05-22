import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100392.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100392 — «Сабо и мюли» (женская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100392,
  nodeName: "Сабо и мюли",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Сабо и мюли"],
  sizeValues: snapshot.externalValues.Size,
});
