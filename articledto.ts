import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";

export enum ArticleStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export class CreateTagDto {
  @ApiProperty({
    description: "Tag name in English",
    example: "Technology",
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: "Tag name in Arabic",
    example: "تكنولوجيا",
  })
  @IsString()
  @IsOptional()
  nameAr?: string;
}

export class CreateArticleDto {
  @ApiProperty({ required: true })
  @IsString()
  title: string;

  @ApiProperty({ required: true })
  @IsString()
  titleAr: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  content: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contentAr: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  summary: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  summaryAr: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  categoryId: string;

  @ApiProperty({ enum: ArticleStatus, default: ArticleStatus.DRAFT })
  @IsEnum(ArticleStatus)
  @IsOptional()
  status: ArticleStatus;

  @ApiProperty({
    type: "array",
    items: { type: "string", format: "binary" },
    required: false,
    description: "Array of image files",
  })
  @IsOptional()
  images?: Express.Multer.File[];

  @ApiProperty({
    type: "array",
    items: { type: "string", format: "binary" },
    required: false,
    description: "Array of video files",
  })
  @IsOptional()
  videos?: Express.Multer.File[];

  @ApiProperty({
    type: "string",
    format: "binary",
    required: false,
    description: "Featured media file",
  })
  @IsOptional()
  featuredMedia?: Express.Multer.File;

  @ApiProperty({
    type: "string",
    required: false,
    description:
      'JSON string of tags array [{"name": "string", "nameAr": "string"}]',
    example: '[{"name":"Technology","nameAr":"تكنولوجيا"}]',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiProperty({
    type: "array",
    items: {
      type: "string",
    },
    required: false,
    description:
      "Array of existing tag IDs. Can be passed as comma-separated string.",
    example: [
      "123e4567-e89b-12d3-a456-426614174000",
      "987fcdeb-51a2-4321-b987-654321098abc",
    ],
  })
  @IsOptional()
  @IsString({ each: true })
  tagIds?: string | string[];

  constructor() {
    this.title = "";
    this.titleAr = "";
    this.content = "";
    this.contentAr = "";
    this.summary = "";
    this.summaryAr = "";
    this.categoryId = "";
    this.status = ArticleStatus.DRAFT;
    this.tags = "";
  }
}
