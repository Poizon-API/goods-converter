import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100395.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100395 — «Сандалии» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100395,
  nodeName: "Сандалии",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Сандалии"],
  sizeValues: snapshot.externalValues.Size,
});
