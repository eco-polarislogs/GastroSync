package com.gastrosync.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI gastroSyncOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("GastroSync Restoran & Gastronomi İşletim Sistemi API")
                        .description("Stok yönetimi, reçete mühendisliği, food cost maliyet analizi, POS satış entegrasyonu ve mobil depo terminali için kurumsal REST API.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("GastroSync Geliştirme Ekibi")
                                .email("destek@gastrosync.com"))
                        .license(new License().name("Apache 2.0")));
    }
}
