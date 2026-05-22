import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100387.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100387 — «Ботинки и полуботинки» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100387,
  nodeName: "Ботинки и полуботинки",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Ботинки и полуботинки"],
  sizeValues: snapshot.externalValues.Size,
});
