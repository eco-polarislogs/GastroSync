package com.gastrosync.service.push;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Expo Push Service istemcisi: POST https://exp.host/--/api/v2/push/send, istek basina en fazla 100 mesaj.
 * Biletler mesaj sirasiyla doner; "DeviceNotRegistered" hatasi alan token'lar cagirana bildirilir (silinir).
 * Erisim token'i (Expo "Enhanced push security") opsiyoneldir: GASTROSYNC_EXPO_ACCESS_TOKEN.
 */
@Component
public class ExpoPushGateway implements PushGateway {

    private static final Logger log = LoggerFactory.getLogger(ExpoPushGateway.class);
    private static final int BATCH = 100;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper;
    private final String url;
    private final String accessToken;
    private final String channelId;

    public ExpoPushGateway(ObjectMapper objectMapper,
                           @Value("${gastrosync.push.expo-url:https://exp.host/--/api/v2/push/send}") String url,
                           @Value("${gastrosync.push.expo-access-token:}") String accessToken,
                           @Value("${gastrosync.push.android-channel:gastrosync}") String channelId) {
        this.objectMapper = objectMapper;
        this.url = url;
        this.accessToken = accessToken;
        this.channelId = channelId;
    }

    @Override
    public List<String> send(List<PushMessage> messages) {
        List<String> invalid = new ArrayList<>();
        for (int i = 0; i < messages.size(); i += BATCH) {
            List<PushMessage> batch = messages.subList(i, Math.min(messages.size(), i + BATCH));
            try {
                List<Map<String, Object>> body = new ArrayList<>();
                for (PushMessage m : batch) {
                    Map<String, Object> msg = new LinkedHashMap<>();
                    msg.put("to", m.to());
                    msg.put("title", m.title());
                    msg.put("body", m.body());
                    msg.put("data", m.data());
                    msg.put("sound", "default");
                    msg.put("priority", "high");
                    msg.put("channelId", channelId);
                    body.add(msg);
                }
                HttpRequest.Builder rb = HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(10))
                        .header("Accept", "application/json")
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
                if (accessToken != null && !accessToken.isBlank()) rb.header("Authorization", "Bearer " + accessToken);
                HttpResponse<String> res = http.send(rb.build(), HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() / 100 != 2) {
                    log.warn("Expo push istegi basarisiz: HTTP {} {}", res.statusCode(), truncate(res.body()));
                    continue;
                }
                JsonNode tickets = objectMapper.readTree(res.body()).path("data");
                for (int t = 0; t < tickets.size() && t < batch.size(); t++) {
                    JsonNode ticket = tickets.get(t);
                    if ("error".equals(ticket.path("status").asText())) {
                        String err = ticket.path("details").path("error").asText("");
                        if ("DeviceNotRegistered".equals(err)) invalid.add(batch.get(t).to());
                        else log.debug("Expo push bileti hatasi: {} {}", err, ticket.path("message").asText());
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return invalid;
            } catch (Exception e) {
                log.warn("Expo push gonderilemedi: {}", e.getMessage());
            }
        }
        return invalid;
    }

    private static String truncate(String s) {
        return s == null ? "" : s.length() > 300 ? s.substring(0, 300) : s;
    }
}
