import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100383.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100383 — «Туфли» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100383,
  nodeName: "Туфли",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Туфли"],
  sizeValues: snapshot.externalValues.Size,
});
