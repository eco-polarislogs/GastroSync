package com.gastrosync.service.print;

import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.text.Normalizer;

/**
 * Minimal ESC/POS komut ureticisi (Epson uyumlu termal yazicilar).
 * Turkce karakterler icin kod sayfasi PC857 (ESC t 13) kullanilir; desteklemeyen yazicida
 * {@link #asciiFallback} ile harfler ASCII karsiliklarina indirgenir.
 */
public final class EscPos {

    private final ByteArrayOutputStream out = new ByteArrayOutputStream();
    private final int width;
    private final Charset charset;
    private final boolean asciiOnly;

    public EscPos(int width) {
        this.width = Math.max(24, Math.min(64, width));
        Charset cs;
        boolean ascii = false;
        try {
            cs = Charset.forName("IBM857");
        } catch (RuntimeException e) {
            cs = Charset.forName("US-ASCII");
            ascii = true;
        }
        this.charset = cs;
        this.asciiOnly = ascii;
        raw(0x1B, 0x40);                 // ESC @  yaziciyi sifirla
        if (!ascii) raw(0x1B, 0x74, 13); // ESC t 13  PC857 Turkce
    }

    public int width() { return width; }

    private EscPos raw(int... bytes) {
        for (int b : bytes) out.write(b);
        return this;
    }

    public EscPos text(String s) {
        String v = s == null ? "" : s.replace("₺", "TL");
        if (asciiOnly) v = asciiFallback(v);
        byte[] b = v.getBytes(charset);
        out.write(b, 0, b.length);
        return this;
    }

    public EscPos line(String s) { return text(s).raw(0x0A); }

    public EscPos newline() { return raw(0x0A); }

    public EscPos bold(boolean on) { return raw(0x1B, 0x45, on ? 1 : 0); }

    /** Cift genislik + cift yukseklik */
    public EscPos big(boolean on) { return raw(0x1D, 0x21, on ? 0x11 : 0x00); }

    public EscPos center() { return raw(0x1B, 0x61, 1); }

    public EscPos left() { return raw(0x1B, 0x61, 0); }

    public EscPos rule() { return line("-".repeat(width)); }

    /** Sol metin + sag metin ayni satirda (sol uzunsa kirpilir) */
    public EscPos pair(String leftText, String rightText) {
        String l = leftText == null ? "" : leftText;
        String r = rightText == null ? "" : rightText;
        int space = width - r.length() - 1;
        if (space < 4) return line(l).line(" ".repeat(Math.max(0, width - r.length())) + r);
        if (l.length() > space) l = l.substring(0, space);
        return line(l + " ".repeat(width - l.length() - r.length()) + r);
    }

    /** Uzun metni satir genisligine gore sarar */
    public EscPos wrap(String s, String indent) {
        String rest = s == null ? "" : s.trim();
        String pad = indent == null ? "" : indent;
        int w = width - pad.length();
        while (rest.length() > w) {
            int cut = rest.lastIndexOf(' ', w);
            if (cut <= 0) cut = w;
            line(pad + rest.substring(0, cut).trim());
            rest = rest.substring(cut).trim();
        }
        if (!rest.isEmpty()) line(pad + rest);
        return this;
    }

    /** Kagidi besle ve kes (kismi kesim) */
    public EscPos cut() { return raw(0x1B, 0x64, 4).raw(0x1D, 0x56, 66, 0); }

    public byte[] bytes() { return out.toByteArray(); }

    public static String asciiFallback(String s) {
        String t = s.replace('ı', 'i').replace('İ', 'I').replace('ş', 's').replace('Ş', 'S')
                .replace('ğ', 'g').replace('Ğ', 'G').replace('ü', 'u').replace('Ü', 'U')
                .replace('ö', 'o').replace('Ö', 'O').replace('ç', 'c').replace('Ç', 'C').replace("₺", "TL");
        return Normalizer.normalize(t, Normalizer.Form.NFD).replaceAll("[^\\x00-\\x7F]", "");
    }
}
