import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100385.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100385 — «Босоножки» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100385,
  nodeName: "Босоножки",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Босоножки"],
  sizeValues: snapshot.externalValues.Size,
});
