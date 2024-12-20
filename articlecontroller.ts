import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  ArchiveArticlesUsecase,
  AssignMultipleTagsToArticleUsecase,
  CreateArticleUsecase,
  DeleteArticleUsecase,
  GetArticleByIdQuery,
  ListArticlesUsecase,
  MinioFileService,
  PublishArticleUsecase,
  RemoveTagFromArticleUsecase,
  RestoreArchivedArticleUsecase,
  SearchArticlesUsecase,
  UnpublishArticleUsecase,
  UpdateArticleUsecase,
} from "@wdi-website/application";
import {
  Article,
  CreateArticleCommand,
  IFile,
  IFileUploader,
  ITag,
  PublishArticleCommand,
  RemoveTagFromArticleCommand,
  TagRepository,
  UnpublishArticleCommand,
  UpdateArticleCommand,
  User,
  UserRole,
} from "@wdi-website/domain";
import { Authorize } from "../auth/auth.decorator";
import { AuthenticatedUser } from "../auth/user.decorator";
import { DateFormatInterceptor } from "../date-format.interceptor";
import {
  ArticleFilters,
  ArticleStatus,
  CreateArticleDto,
  DisplayArticleDto,
  ListArticlesDto,
  PaginatedArticleResponseDto,
  UpdateArticleDto,
} from "./dto/news";
import { ManualArchiveArticlesDto } from "./dto/news/archive-articles.dto";
import { GetArticleDto } from "./dto/news/get-articles.dto";
import {
  DisplayArticleWithRelatedDto,
  RelatedArticleDto,
} from "./dto/news/related-article.dto";
import {
  SearchArticlesDto,
  SearchArticlesResponseDto,
} from "./dto/news/search/search-articles.dto";
import { AssignTagsDto } from "./dto/news/tags/assign-tag.dto";

@ApiTags("Admin Articles")
@Controller("admin/articles")
@UseInterceptors(DateFormatInterceptor)
export class AdminArticleController {
  constructor(
    private readonly createArticleUsecase: CreateArticleUsecase,
    private readonly getArticleByIdQuery: GetArticleByIdQuery,
    private readonly updateArticleUsecase: UpdateArticleUsecase,
    private readonly listArticlesUsecase: ListArticlesUsecase,
    private readonly deleteArticleUsecase: DeleteArticleUsecase,
    private readonly publishArticleUsecase: PublishArticleUsecase,
    private readonly unpublishArticleUsecase: UnpublishArticleUsecase,
    private readonly removeTagFromArticleUsecase: RemoveTagFromArticleUsecase,
    private readonly archiveArticlesUsecase: ArchiveArticlesUsecase,
    private readonly searchArticlesUsecase: SearchArticlesUsecase,
    private readonly restoreArchivedArticleUsecase: RestoreArchivedArticleUsecase,
    private readonly assignMultipleTagsUsecase: AssignMultipleTagsToArticleUsecase,
    @Inject("IFileUploader") private readonly fileUploader: IFileUploader,
    @Inject("MinioFileDeleter") private readonly fileService: MinioFileService,
    @Inject("TAG_REPOSITORY") private readonly tagRepository: TagRepository
  ) {}

  @Post()
  @Authorize(UserRole.AUTHOR, UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "images", maxCount: 8 },
      { name: "videos", maxCount: 4 },
      { name: "featuredMedia", maxCount: 1 },
    ])
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Create a new article with images and videos",
  })
  @ApiResponse({
    status: 201,
    description: "The article has been successfully created.",
    type: DisplayArticleDto,
  })
  @ApiBody({
    schema: {
      required: ["title", "titleAr"],
      type: "object",
      properties: {
        title: {
          type: "string",
          example: "Example English Title",
          description: "Title of the article in English",
        },
        titleAr: {
          type: "string",
          example: "مثال على العنوان العربي",
          description: "Title of the article in Arabic",
        },
        content: {
          type: "string",
          example: "This is an example of the article content in English.",
          description: "Content of the article in English",
        },
        contentAr: {
          type: "string",
          example: "هذا مثال على محتوى المقال باللغة العربية.",
          description: "Content of the article in Arabic",
        },
        summary: {
          type: "string",
          example: "A brief summary of the article in English.",
          description: "Summary of the article in English",
        },
        summaryAr: {
          type: "string",
          example: "ملخص مختصر للمقال باللغة العربية.",
          description: "Summary of the article in Arabic",
        },
        categoryId: {
          type: "string",
          example: "67890",
          description: "ID of the category",
        },
        status: {
          type: "string",
          enum: ["draft", "published", "archived"],
          default: "draft",
          description: "Status of the article",
        },
        featuredMedia: {
          type: "string",
          format: "binary",
          description: "Featured Media for the article",
          nullable: true,
        },
        images: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
          description: "Additional images for the article",
          nullable: true,
        },
        videos: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
          description: "Videos for the article",
          nullable: true,
        },
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                example: "Technology",
                description: "Tag name in English",
              },
              nameAr: {
                type: "string",
                example: "تكنولوجيا",
                description: "Tag name in Arabic",
              },
            },
          },
          description: "Array of tags with English and Arabic names",
          nullable: true,
        },
        tagIds: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of existing tag IDs",
          example: ["123e4567-e89b-12d3-a456-426614174000"],
          nullable: true,
        },
      },
    },
  })
  async create(
    @Body() dto: CreateArticleDto,
    @UploadedFiles()
    files: {
      featuredMedia?: Express.Multer.File[];
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
    } = { featuredMedia: [], images: [], videos: [] },
    @AuthenticatedUser() user: User
  ): Promise<DisplayArticleDto> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (
        ![UserRole.AUTHOR, UserRole.ADMIN, UserRole.EDITOR].includes(user.role)
      ) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      // Validate file fields
      if (files?.images && typeof files.images === "string") {
        throw new BadRequestException(
          "Images must be file uploads, not strings"
        );
      }
      if (files?.videos && typeof files.videos === "string") {
        throw new BadRequestException(
          "Videos must be file uploads, not strings"
        );
      }
      if (files?.featuredMedia && typeof files.featuredMedia === "string") {
        throw new BadRequestException(
          "Featured media must be a file upload, not a string"
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsedTags: any[] = [];
      let parsedTagIds: string[] = [];

      if (dto.tags) {
        try {
          let parsed;
          // Try to parse as array first
          try {
            parsed = JSON.parse(dto.tags);
          } catch {
            // If parsing as array fails, try wrapping in array and parsing
            parsed = JSON.parse(`[${dto.tags}]`);
          }

          // Ensure we always have an array
          parsedTags = Array.isArray(parsed) ? parsed : [parsed];

          // Validate tag structure
          parsedTags.forEach((tagData) => {
            if (!tagData.name) {
              throw new BadRequestException("Each tag must have a name");
            }
          });
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new BadRequestException("Invalid JSON format for tags");
          }
          throw error;
        }
      }

      // Handle tagIds
      if (dto.tagIds) {
        // If it's already an array, use it directly
        if (Array.isArray(dto.tagIds)) {
          parsedTagIds = dto.tagIds;
        }
        // If it's a comma-separated string, split it into an array
        else if (typeof dto.tagIds === "string") {
          parsedTagIds = dto.tagIds.split(",").map((id) => id.trim());
        }
      }

      // Create initial command (without tags)
      const command: CreateArticleCommand = {
        title: dto.title,
        titleAr: dto.titleAr,
        content: dto.content,
        contentAr: dto.contentAr,
        summary: dto.summary,
        summaryAr: dto.summaryAr,
        authorId: user.id,
        authorEmail: user.email,
        categoryId: dto.categoryId,
        status: dto.status ?? ArticleStatus.DRAFT,
        images: [],
        videos: [],
        featuredMedia: undefined,
        featuredMediaId: undefined,
        tags: [], // Start with empty tags
      };

      // Create article first
      const article = await this.createArticleUsecase.execute(command, user);

      try {
        const allTags: ITag[] = [];

        // Fetch existing tags
        if (parsedTagIds.length > 0) {
          const existingTags = await Promise.all(
            parsedTagIds.map(async (tagId) => {
              const tag = await this.tagRepository.findById(tagId);
              if (!tag) {
                throw new BadRequestException(`Tag with ID ${tagId} not found`);
              }
              return tag;
            })
          );
          allTags.push(...existingTags);
        }

        // Create new tags
        if (parsedTags.length > 0) {
          const newTags = await Promise.all(
            parsedTags.map(async (tagData) => {
              const now = new Date();
              const tagId = crypto.randomUUID();
              const tag: ITag = {
                id: tagId,
                name: tagData.name,
                nameAr: tagData.nameAr,
                createdAt: now,
                updatedAt: now,
              };
              await this.tagRepository.create(tag);
              return tag;
            })
          );
          allTags.push(...newTags);
        }

        // Update article with all tags (both existing and new)
        if (allTags.length > 0) {
          await this.updateArticleUsecase.execute({
            id: article.id,
            tags: allTags,
          });
        }

        // Handle featured media if provided and valid
        if (
          Array.isArray(files?.featuredMedia) &&
          files.featuredMedia[0]?.buffer
        ) {
          const uploadedFeaturedMedia = await this.fileUploader.uploadFile(
            files.featuredMedia[0].buffer,
            files.featuredMedia[0].originalname,
            files.featuredMedia[0].mimetype
          );
          const now = new Date();
          const featuredMedia = {
            id: uploadedFeaturedMedia.id,
            url: uploadedFeaturedMedia.url,
            filename: files.featuredMedia[0].originalname,
            mimetype: files.featuredMedia[0].mimetype,
            size: files.featuredMedia[0].size,
            path: uploadedFeaturedMedia.path ?? "",
            createdAt: now,
            updatedAt: now,
          };

          // Update article with featured media
          await this.updateArticleUsecase.execute({
            id: article.id,
            featuredMedia,
            featuredMediaId: uploadedFeaturedMedia.id,
          });
        }

        // Handle image uploads if provided and valid
        const uploadedImages: IFile[] = [];
        if (Array.isArray(files?.images)) {
          for (const file of files.images) {
            if (!file?.buffer) continue;
            const uploadedFile = await this.fileUploader.uploadFile(
              file.buffer,
              file.originalname,
              file.mimetype
            );
            const now = new Date();
            uploadedImages.push({
              id: uploadedFile.id,
              url: uploadedFile.url,
              filename: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: uploadedFile.path ?? "",
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // Handle video uploads if provided and valid
        const uploadedVideos: IFile[] = [];
        if (Array.isArray(files?.videos)) {
          for (const file of files.videos) {
            if (!file?.buffer) continue;
            const uploadedFile = await this.fileUploader.uploadFile(
              file.buffer,
              file.originalname,
              file.mimetype
            );
            const now = new Date();
            uploadedVideos.push({
              id: uploadedFile.id,
              url: uploadedFile.url,
              filename: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: uploadedFile.path ?? "",
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // Update article with images and videos if any were uploaded
        if (uploadedImages.length > 0 || uploadedVideos.length > 0) {
          await this.updateArticleUsecase.execute({
            id: article.id,
            images: uploadedImages,
            videos: uploadedVideos,
          });
        }

        // Return the final article state
        const updatedArticle = await this.getArticleByIdQuery.execute(
          article.id
        );
        return this.mapToDisplayDto(updatedArticle);
      } catch (uploadError) {
        // If file uploads fail, delete the article and throw error
        await this.deleteArticleUsecase.execute({ id: article.id });
        console.error("File upload error:", uploadError);
        throw new BadRequestException(
          `Failed to upload files: ${
            uploadError instanceof Error ? uploadError.message : "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("Article creation error:", error);
      throw new BadRequestException(
        `Failed to create article: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  @Get()
  @Authorize(UserRole.AUTHOR, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({
    summary: "List articles with language filtering",
    description:
      "Returns articles based on user role. Authors can only view their own articles, while Admins and Editors can view all articles.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns a paginated list of news articles",
    type: PaginatedArticleResponseDto,
  })
  async list(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    )
    dto: ListArticlesDto,
    @AuthenticatedUser() user: User
  ): Promise<PaginatedArticleResponseDto> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }

      // Create the base query filters with proper typing
      const filters: ArticleFilters = {
        categoryId: dto.categoryId,
        tags: dto.tagId
          ? [
              {
                id: dto.tagId,
                name: "",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]
          : undefined,
        status: dto.status,
      };

      // If user is an AUTHOR, force their ID as the filter
      if (user.role === UserRole.AUTHOR) {
        // Throw error if trying to access other authors' articles
        if (dto.authorId && dto.authorId !== user.id) {
          throw new ForbiddenException(
            "Authors can only view their own articles"
          );
        }

        // Now TypeScript knows authorId is a valid property
        filters.authorId = user.id;
      } else if ([UserRole.ADMIN, UserRole.EDITOR].includes(user.role)) {
        // For admin/editor, only add authorId filter if specifically requested
        if (dto.authorId) {
          filters.authorId = dto.authorId;
        }
      }

      // Execute the query with enforced filters
      const result = await this.listArticlesUsecase.execute({
        page: dto.page,
        limit: dto.limit,
        sortBy: dto.sortBy,
        sortOrder: dto.sortOrder,
        filters: filters,
      });

      // Verify the response data
      if (user.role === UserRole.AUTHOR) {
        // Double-check that all returned articles belong to the author
        result.data = result.data.filter(
          (article) => article.authorId === user.id
        );
        // Update metadata to reflect filtered results
        result.metadata.total = result.data.length;
        result.metadata.totalPages = Math.ceil(
          result.metadata.total / dto.limit
        );
      }

      return {
        data: result.data.map((article) => this.mapToGetArticleDto(article)),
        metadata: result.metadata,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException("Failed to fetch articles");
    }
  }

  @Patch("archive")
  @Authorize(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Archive selected articles",
    description: "Archives the specified list of published articles",
  })
  @ApiResponse({
    status: 200,
    description: "Articles successfully archived",
    schema: {
      type: "object",
      properties: {
        totalProcessed: {
          type: "number",
          description: "Total number of articles processed",
        },
        archived: {
          type: "number",
          description: "Number of articles successfully archived",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request - Invalid article IDs or articles not eligible for archiving",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Authentication required",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User does not have required permissions",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  async archiveArticles(
    @Body() dto: ManualArchiveArticlesDto,
    @AuthenticatedUser() user: User
  ): Promise<{ totalProcessed: number; archived: number }> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }

      if (![UserRole.EDITOR, UserRole.ADMIN].includes(user.role)) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }

      const result = await this.archiveArticlesUsecase.execute({
        articleIds: dto.articleIds,
      });

      return result;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to archive articles: ${error.message}`
        );
      }

      throw new InternalServerErrorException("Failed to archive articles");
    }
  }

  @Get("search")
  @ApiOperation({
    summary: "Search articles in the admin panel with filtering options",
  })
  @Authorize(UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR)
  @ApiResponse({
    status: 200,
    description: "Search articles by various criteria",
    type: SearchArticlesResponseDto,
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "published", "archived"],
    description: "Filter articles by status",
  })
  async searchArticles(
    @Query(new ValidationPipe({ transform: true })) query: SearchArticlesDto,
    @AuthenticatedUser() user: User
  ): Promise<SearchArticlesResponseDto> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (
        ![UserRole.EDITOR, UserRole.ADMIN, UserRole.AUTHOR].includes(user.role)
      ) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      const result = await this.searchArticlesUsecase.execute(query);
      return new SearchArticlesResponseDto(
        result.articles,
        query.page || 1,
        query.pageSize || 10,
        result.totalResults
      );
    } catch (error) {
      // Handle different types of errors
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // For any other unexpected errors, throw a generic server error
      throw new InternalServerErrorException(
        "An unexpected error occurred while searching articles"
      );
    }
  }

  @Get(":id")
  @Authorize(UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR)
  @ApiOperation({ summary: "Get an article by ID with related articles" })
  @ApiResponse({
    status: 200,
    description: "Return the article with related articles.",
    type: DisplayArticleWithRelatedDto,
  })
  @ApiResponse({
    status: 404,
    description: "Article not found.",
  })
  async findById(
    @Param("id") id: string,
    @AuthenticatedUser() user: User
  ): Promise<DisplayArticleWithRelatedDto> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }

      const articleWithRelated = await this.getArticleByIdQuery.execute(id);

      if (!articleWithRelated) {
        throw new NotFoundException("Article not found");
      }

      // Authorization check based on user role
      if (user.role === UserRole.AUTHOR) {
        if (articleWithRelated.authorId !== user.id) {
          throw new ForbiddenException(
            "You are not authorized to access this article."
          );
        }
      }

      const mainArticle = this.mapToDisplayDto(articleWithRelated);

      // Only include related articles if the main article is published
      const relatedArticles =
        articleWithRelated.status === "published"
          ? articleWithRelated.relatedArticles.map(
              (related) =>
                new RelatedArticleDto({
                  id: related.id,
                  title: related.title,
                  titleAr: related.titleAr,
                  summary: related.summary,
                  summaryAr: related.summaryAr,
                  categoryId: related.categoryId,
                  category: related.category
                    ? {
                        id: related.category.id,
                        name: related.category.name,
                        nameAr: related.category.nameAr,
                      }
                    : undefined,
                  createdAt: related.createdAt,
                  updatedAt: related.updatedAt,
                  publishedAt: related.publishedAt,
                  views: related.views,
                  slug: related.slug,
                  slugAr: related.slugAr,
                  featuredMedia: related.featuredMedia
                    ? {
                        id: related.featuredMedia.id,
                        url: related.featuredMedia.url,
                      }
                    : undefined,
                  tags: related.tags
                    ? related.tags.map((tag) => ({
                        id: tag.id,
                        name: tag.name,
                        nameAr: tag.nameAr,
                      }))
                    : undefined,
                })
            )
          : [];

      return new DisplayArticleWithRelatedDto({
        ...mainArticle,
        relatedArticles,
      });
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        "An unexpected error occurred while fetching the article"
      );
    }
  }

  @Patch(":id/publish")
  @Authorize(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Publish an article" })
  @ApiResponse({
    status: 200,
    description: "The article has been successfully published.",
    type: DisplayArticleDto,
  })
  @ApiResponse({
    status: 404,
    description: "Article not found.",
  })
  async publish(
    @Param("id") id: string,
    @AuthenticatedUser() user: User
  ): Promise<DisplayArticleDto> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (![UserRole.EDITOR, UserRole.ADMIN].includes(user.role)) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      const command: PublishArticleCommand = {
        articleId: id,
      };

      const article = await this.publishArticleUsecase.execute(command);
      return this.mapToDisplayDto(article);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          throw new NotFoundException("Article not found");
        }
      }
      throw error;
    }
  }

  @Patch(":id/unpublish")
  @Authorize(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Unpublish an article" })
  @ApiResponse({
    status: 200,
    description: "The article has been successfully unpublished.",
    type: DisplayArticleDto,
  })
  @ApiResponse({
    status: 404,
    description: "Article not found.",
  })
  async unpublish(
    @Param("id") id: string,
    @AuthenticatedUser() user: User
  ): Promise<DisplayArticleDto> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (![UserRole.EDITOR, UserRole.ADMIN].includes(user.role)) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      const command: UnpublishArticleCommand = {
        articleId: id,
      };

      const article = await this.unpublishArticleUsecase.execute(command);
      return this.mapToDisplayDto(article);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          throw new NotFoundException("Article not found");
        }
      }
      throw error;
    }
  }

  private parseArrayField(value: unknown): string[] {
    if (!value) return [];

    try {
      // If it's already an array, flatten it and filter out nulls
      if (Array.isArray(value)) {
        return value
          .flat()
          .filter((item) => item !== null && item !== undefined);
      }

      // If it's a string, try to parse it as JSON
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed
              .flat()
              .filter((item) => item !== null && item !== undefined);
          }
          return parsed ? [parsed] : [];
        } catch {
          // If JSON parse fails, split by comma
          return value
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item);
        }
      }

      return [];
    } catch (error) {
      console.error("Parse array field error:", error);
      return [];
    }
  }

  @Patch(":id")
  @Authorize(UserRole.AUTHOR, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Update an article" })
  @ApiResponse({
    status: 200,
    description: "The article has been successfully updated.",
    type: DisplayArticleDto,
  })
  @ApiResponse({
    status: 404,
    description: "Article not found.",
  })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "images", maxCount: 8 },
      { name: "videos", maxCount: 4 },
      { name: "featuredMedia", maxCount: 1 },
    ])
  )
  @ApiParam({
    name: "id",
    required: true,
    description: "Article ID",
  })
  @ApiBody({
    type: UpdateArticleDto,
    description: "Update article data with files",
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateArticleDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
      featuredMedia?: Express.Multer.File[];
    },
    @AuthenticatedUser() user: User
  ): Promise<DisplayArticleDto> {
    try {
      // Fetch the existing article
      const existingArticle = await this.getArticleByIdQuery.execute(id);

      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (
        user.role === UserRole.AUTHOR &&
        existingArticle.authorId !== user.id
      ) {
        throw new ForbiddenException(
          "Only the author owner can update this article"
        );
      }
      if (!existingArticle) {
        throw new NotFoundException("Article not found");
      }

      // Parse the removed files arrays
      const removedImageIds = this.parseArrayField(dto.removedImages);
      const removedVideoIds = this.parseArrayField(dto.removedVideos);
      const removedTagIds = this.parseArrayField(dto.removedTags);
      const tagIds = this.parseArrayField(dto.tags);

      // Handle file deletions
      await Promise.all([
        ...removedImageIds.map(async (fileId) => {
          try {
            await this.fileService.deleteFile(fileId);
          } catch (error) {
            console.error(`Failed to delete image ${fileId}:`, error);
          }
        }),
        ...removedVideoIds.map(async (fileId) => {
          try {
            await this.fileService.deleteFile(fileId);
          } catch (error) {
            console.error(`Failed to delete video ${fileId}:`, error);
          }
        }),
      ]);

      // Handle featured media upload
      let uploadedFeaturedMedia: IFile | undefined;
      if (files?.featuredMedia?.[0]) {
        uploadedFeaturedMedia = await this.fileUploader.uploadFile(
          files.featuredMedia[0].buffer,
          files.featuredMedia[0].originalname,
          files.featuredMedia[0].mimetype
        );

        // If there's an existing featured media, delete it
        if (existingArticle.featuredMedia) {
          try {
            await this.fileService.deleteFile(existingArticle.featuredMedia.id);
          } catch (error) {
            console.error(`Failed to delete old featured media:`, error);
          }
        }
      }

      // Handle new file uploads
      const uploadedImages = files?.images
        ? await Promise.all(
            files.images.map((file) =>
              this.fileUploader.uploadFile(
                file.buffer,
                file.originalname,
                file.mimetype
              )
            )
          )
        : [];

      const uploadedVideos = files?.videos
        ? await Promise.all(
            files.videos.map((file) =>
              this.fileUploader.uploadFile(
                file.buffer,
                file.originalname,
                file.mimetype
              )
            )
          )
        : [];

      const existingTags = existingArticle.tags || [];

      const remainingTags = existingTags.filter(
        (tag) => !removedTagIds.includes(tag.id)
      );

      const newTags = tagIds
        .filter(
          (tagId) =>
            !existingTags.some((existingTag) => existingTag.id === tagId)
        )
        .map((id) => ({ id } as ITag));

      // Prepare the update command
      const command: UpdateArticleCommand = {
        id,
        title: dto.title,
        titleAr: dto.titleAr,
        content: dto.content,
        contentAr: dto.contentAr,
        summary: dto.summary,
        summaryAr: dto.summaryAr,
        categoryId: dto.categoryId,
        images: [
          ...(existingArticle.images || []).filter(
            (file) => !removedImageIds.includes(file.id)
          ),
          ...uploadedImages,
        ],
        videos: [
          ...(existingArticle.videos || []).filter(
            (file) => !removedVideoIds.includes(file.id)
          ),
          ...uploadedVideos,
        ],
        tags: [...remainingTags, ...newTags],
        tagsToRemove: removedTagIds,
        featuredMedia: uploadedFeaturedMedia,
        featuredMediaId: uploadedFeaturedMedia?.id,
      };

      // Execute the update
      await this.updateArticleUsecase.execute(command);

      // Return updated article
      const refreshedArticle = await this.getArticleByIdQuery.execute(id);
      return this.mapToDisplayDto(refreshedArticle);
    } catch (error) {
      console.error("Update article error:", error);

      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to update article: ${error.message}`
        );
      }

      throw new BadRequestException("Failed to update article: Unknown error");
    }
  }

  @Delete(":id")
  @Authorize(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete an article permanently",
    description:
      "Permanently removes an article and its associated files (images, videos) from the system. This action cannot be undone.",
  })
  @ApiResponse({
    status: 204,
    description: "The article and its files have been successfully deleted",
  })
  @ApiResponse({
    status: 404,
    description: "Article not found",
  })
  async delete(
    @Param("id") id: string,
    @AuthenticatedUser() user: User
  ): Promise<void> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (![UserRole.ADMIN, UserRole.EDITOR].includes(user.role)) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      // Retrieve the article to get its associated files (if any)
      const article = await this.getArticleByIdQuery.execute(id);
      if (!article) {
        throw new NotFoundException("Article not found");
      }

      // Only delete associated files if the article status is draft
      if (article.status === "draft") {
        // Delete featured media if it exists
        if (article.featuredMedia) {
          try {
            await this.fileService.deleteFile(article.featuredMedia.id);
          } catch (error) {
            if (error instanceof Error) {
              console.error(
                `Failed to delete featured media: ${error.message}`
              );
            } else {
              console.error("Failed to delete featured media: Unknown error");
            }
          }
        }

        // Delete associated images
        if (article.images && article.images.length > 0) {
          for (const image of article.images) {
            try {
              await this.fileService.deleteFile(image.id);
            } catch (error) {
              if (error instanceof Error) {
                console.error(`Failed to delete image: ${error.message}`);
              } else {
                console.error("Failed to delete image: Unknown error");
              }
            }
          }
        }

        // Delete associated videos
        if (article.videos && article.videos.length > 0) {
          for (const video of article.videos) {
            try {
              await this.fileService.deleteFile(video.id);
            } catch (error) {
              if (error instanceof Error) {
                console.error(`Failed to delete video: ${error.message}`);
              } else {
                console.error("Failed to delete video: Unknown error");
              }
            }
          }
        }
      }

      // Delete the article itself
      await this.deleteArticleUsecase.execute({ id });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        "Failed to delete article and associated files",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(":id/unarchive")
  @Authorize(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Unarchive an archived article" })
  @ApiResponse({
    status: 200,
    description: "The article has been successfully unarchived.",
  })
  @ApiResponse({
    status: 404,
    description: "Article not found.",
  })
  async restore(
    @Param("id") id: string,
    @AuthenticatedUser() user: User
  ): Promise<void> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (![UserRole.EDITOR, UserRole.ADMIN].includes(user.role)) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      await this.restoreArchivedArticleUsecase.execute(id);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          throw new NotFoundException("Article not found");
        }
      }
      throw error;
    }
  }

  @Delete(":articleId/tags/:tagId")
  @Authorize(UserRole.AUTHOR, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Remove a tag from an article" })
  @ApiResponse({
    status: 204,
    description: "The tag has been successfully removed from the article.",
  })
  async removeTag(
    @Param("articleId") articleId: string,
    @Param("tagId") tagId: string,
    @AuthenticatedUser() user: User
  ) {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (
        ![UserRole.EDITOR, UserRole.ADMIN, UserRole.AUTHOR].includes(user.role)
      ) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      const command: RemoveTagFromArticleCommand = { articleId, tagId };
      return await this.removeTagFromArticleUsecase.execute(command);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        "Failed to remove tag from article"
      );
    }
  }

  @Post(":id/tags")
  @Authorize(UserRole.AUTHOR, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Assign multiple tags to an article" })
  @ApiParam({
    name: "id",
    description: "Article ID",
    required: true,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Tags successfully assigned to the article",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid tag IDs or article ID",
  })
  @ApiResponse({
    status: 404,
    description: "Article not found",
  })
  async assignTags(
    @Param("id") id: string,
    @Body() dto: AssignTagsDto,
    @AuthenticatedUser() user: User
  ): Promise<void> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (
        ![UserRole.EDITOR, UserRole.ADMIN, UserRole.AUTHOR].includes(user.role)
      ) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      await this.assignMultipleTagsUsecase.execute({
        articleId: id,
        tagIds: dto.tagIds,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to assign tags: ${error.message}`
        );
      }
      throw new BadRequestException("Failed to assign tags");
    }
  }

  private mapToDisplayDto(article: Article): DisplayArticleDto {
    const displayDto = new DisplayArticleDto();

    displayDto.id = article.id;
    displayDto.title = article.title;
    displayDto.titleAr = article.titleAr;
    displayDto.content = article.content;
    displayDto.contentAr = article.contentAr;
    displayDto.summary = article.summary;
    displayDto.summaryAr = article.summaryAr;
    displayDto.authorId = article.authorId;
    displayDto.authorEmail = article.authorEmail;
    displayDto.categoryId = article.category?.id || "";
    displayDto.category = article.category
      ? {
          id: article.category.id,
          name: article.category.name,
          nameAr: article.category.nameAr,
        }
      : undefined;
    displayDto.tags = article.tags?.map((tag) => ({
      id: tag.id,
      name: tag.name,
      nameAr: tag.nameAr,
    }));
    displayDto.createdAt = article.createdAt;
    displayDto.updatedAt = article.updatedAt;
    displayDto.publishedAt = article.publishedAt;
    displayDto.status = article.status;
    displayDto.views = article.views;
    displayDto.slug = article.slug;
    displayDto.slugAr = article.slugAr ?? "";
    displayDto.images = article.images?.map((image) => ({
      id: image.id,
      url: image.url,
    }));

    displayDto.videos = article.videos?.map((video) => ({
      id: video.id,
      url: video.url,
    }));
    displayDto.featuredMedia = article.featuredMedia
      ? { id: article.featuredMedia.id, url: article.featuredMedia.url }
      : undefined;
    return displayDto;
  }

  private mapToGetArticleDto(article: Article): GetArticleDto {
    const getArticleDto = new GetArticleDto();
    getArticleDto.id = article.id;
    getArticleDto.title = article.title;
    getArticleDto.titleAr = article.titleAr;
    getArticleDto.summary = article.summary;
    getArticleDto.summaryAr = article.summaryAr;
    getArticleDto.category = article.category
      ? {
          id: article.category.id,
          name: article.category.name,
          nameAr: article.category.nameAr,
        }
      : undefined;
    getArticleDto.authorId = article.authorId;
    getArticleDto.authorEmail = article.authorEmail;
    getArticleDto.views = article.views;
    getArticleDto.slug = article.slug;
    getArticleDto.slugAr = article.slugAr;
    getArticleDto.status = article.status;
    getArticleDto.tags = article.tags?.map((tag) => ({
      id: tag.id,
      name: tag.name,
      nameAr: tag.nameAr,
    }));
    getArticleDto.featuredMedia = article.featuredMedia
      ? { id: article.featuredMedia.id, url: article.featuredMedia.url }
      : undefined;

    return getArticleDto;
  }
}
