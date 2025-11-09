import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Files, FilesSchema } from './files.model';
import { FilesRepository } from './files.repository';
import { FilesProvider } from './files.provider';


@Module({
    imports: [
        MongooseModule.forFeature([{ name: Files.name, schema: FilesSchema }]),
    ],
    providers: [FilesRepository, FilesProvider],
    exports: [FilesProvider],
})
export class FilesModule {}
