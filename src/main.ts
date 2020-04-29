import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import {
    ExpressAdapter,
    NestExpressApplication,
} from '@nestjs/platform-express';
import { RoleType } from 'common/constants';
import * as compression from 'compression';
import * as RateLimit from 'express-rate-limit';
import { HttpExceptionFilter, QueryFailedFilter } from 'filters';
import * as helmet from 'helmet';
import { CurrencyCron } from 'modules/currency/crons';
import { CurrencyService } from 'modules/currency/services';
import { UserAuthService, UserService } from 'modules/user/services';
import * as morgan from 'morgan';
import { SharedModule } from 'shared/modules';
import { ConfigService } from 'shared/services';
import {
    initializeTransactionalContext,
    patchTypeORMRepositoryWithBaseRepository,
} from 'typeorm-transactional-cls-hooked';

import { AppModule } from './app.module';
import { setupSwagger } from './viveo-swagger';

async function bootstrap() {
    initializeTransactionalContext();
    patchTypeORMRepositoryWithBaseRepository();
    const app = await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(),
        {
            cors: true,
        },
    );
    app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
    app.use(helmet());
    app.use(
        RateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
        }),
    );
    app.use(compression());
    app.use(morgan('combined'));
    app.setGlobalPrefix('api');

    const reflector = app.get(Reflector);

    app.useGlobalFilters(
        new HttpExceptionFilter(reflector),
        new QueryFailedFilter(reflector),
    );

    app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            dismissDefaultMessages: true,
            validationError: {
                target: false,
            },
        }),
    );

    const configService = app.select(SharedModule).get(ConfigService);

    app.connectMicroservice({
        transport: Transport.TCP,
        options: {
            port: configService.getNumber('TRANSPORT_PORT'),
            retryAttempts: 5,
            retryDelay: 3000,
        },
    });

    await app.startAllMicroservicesAsync();

    if (['development', 'staging'].includes(configService.nodeEnv)) {
        setupSwagger(app);
    }

    const port = configService.getNumber('PORT');
    await app.listen(port);

    // todo: przerobic to na osobny serwis
    await app.get(CurrencyCron).setCurrencyForeignExchangeRates();

    const { uuid } = await app
        .get(CurrencyService)
        .findCurrency({ name: 'USD' });

    const isUser = await app.get(UserService).getUser({
        email: 'root@bank.pietrzakadrian.com',
    });

    if (!isUser) {
        const userAuth = await app.get(UserService).createUser({
            firstName: 'Bank',
            lastName: 'Application',
            email: 'root@bank.pietrzakadrian.com',
            password: '123456789',
            currency: uuid,
        });
        await app.get(UserAuthService).updateRole(userAuth, RoleType.ADMIN);
    }
    // todo: przerobic to na osobny serwiss

    console.info(`server running on port ${port}`);
}

bootstrap();
