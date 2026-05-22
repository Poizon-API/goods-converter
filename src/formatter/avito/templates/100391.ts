import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100391.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100391 — «Угги, валенки, дутики» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100391,
  nodeName: "Угги, валенки, дутики",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Угги, валенки, дутики"],
  sizeValues: snapshot.externalValues.Size,
});
