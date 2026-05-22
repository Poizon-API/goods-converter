import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100386.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100386 — «Ботильоны» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100386,
  nodeName: "Ботильоны",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Ботильоны"],
  sizeValues: snapshot.externalValues.Size,
});
