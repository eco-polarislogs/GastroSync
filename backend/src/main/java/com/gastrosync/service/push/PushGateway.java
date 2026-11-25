package com.gastrosync.service.push;

import java.util.List;
import java.util.Map;

/**
 * Push saglayici soyutlamasi (varsayilan: Expo Push Service -> FCM / APNs).
 * Donus: artik gecersiz oldugu bildirilen (DeviceNotRegistered) token'lar.
 */
public interface PushGateway {

    record PushMessage(String to, String title, String body, Map<String, Object> data) {}

    List<String> send(List<PushMessage> messages);
}
