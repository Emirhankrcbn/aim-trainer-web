// Bu fonksiyon Supabase Dashboard'da "bright-processor" adiyla deploy edilmiştir.
// script.js bu isimle çağırır: /functions/v1/bright-processor
// Kodun kaynağı burada tutulur ki repo dışında (yalnızca dashboard'da) kalmasın.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, score, hits, clicks, timePlayed, maxCombo, sessionToken } = await req.json()

    // ── 1. GİRDİ KONTROL ──────────────────────────────────────────────
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return error('Geçersiz kullanıcı adı.')
    }
    if (username.length > 32) {
      return error('Kullanıcı adı çok uzun.')
    }
    if (!sessionToken || typeof sessionToken !== 'string') {
      return error('Geçersiz oturum.')
    }

    // ── 2. SÜRE KONTROL ───────────────────────────────────────────────
    // Oyun 30 saniye = 30000ms. En az 29 saniye oynamış olmalı.
    if (typeof timePlayed !== 'number' || timePlayed < 29000) {
      return error('Süre doğrulaması başarısız.')
    }
    // 35 saniyeyi aşan süreler de şüpheli (sunucu gecikmesi için +3s tolerans)
    if (timePlayed > 35000) {
      return error('Süre aşımı hatası.')
    }

    // ── 3. FİZİKSEL İMKANSIZLIK KONTROL ──────────────────────────────
    // 30 saniyede bir hedef en az ~300ms'de tıklanabilir => max ~100 vuruş
    // Her vuruş max 6 puan (headshot 3pt x2 combo) => max ~600 puan
    // Güvenli üst limit: 620
    if (typeof score !== 'number' || score < 0 || score > 620) {
      return error(`İmkansız skor: ${score}`)
    }

    // ── 4. TIKLAMA / İSABET KONTROL ───────────────────────────────────
    if (typeof clicks !== 'number' || typeof hits !== 'number') {
      return error('Tıklama verisi eksik.')
    }
    if (hits > clicks) {
      return error('İsabet sayısı tıklamadan fazla olamaz.')
    }
    if (hits < 0 || clicks < 0) {
      return error('Negatif değer.')
    }
    // 30 saniyede 100'den fazla vuruş fiziksel olarak çok zor
    if (hits > 100) {
      return error(`Çok fazla vuruş: ${hits}`)
    }
    // %99+ isabet oranı VE 20+ vuruş => bot şüphesi
    if (hits > 20 && clicks > 0 && (hits / clicks) > 0.99) {
      return error('Şüpheli isabet oranı (bot tespiti).')
    }

    // ── 5. COMBO KONTROL ──────────────────────────────────────────────
    if (typeof maxCombo !== 'number' || maxCombo < 0 || maxCombo > hits) {
      return error(`Geçersiz combo: ${maxCombo}`)
    }

    // ── 6. SKOR TUTARLILIK KONTROL ────────────────────────────────────
    // Minimum olası skor: hits * 2 (tüm normal vuruşlar)
    // Maximum olası skor: hits * 6 (tüm headshot + 2x combo)
    const minPossibleScore = hits * 2 - clicks * 1  // iskaların -1 cezası
    const maxPossibleScore = hits * 6 + 20           // +20 tolerans
    if (score > maxPossibleScore) {
      return error(`Skor fiziksel limiti aşıyor. Max: ${maxPossibleScore}, Gönderilen: ${score}`)
    }

    // ── 7. SUPABASE'E KAYDET ──────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // Service role key sadece sunucuda!
    )

    // Mevcut skoru kontrol et, yüksek olanı tut
    const { data: existing } = await supabase
      .from('leaderboard')
      .select('score')
      .eq('username', username.trim())

    let scoreToSave = score
    if (existing && existing.length > 0) {
      const highestOld = Math.max(...existing.map((r: any) => r.score))
      if (highestOld > score) scoreToSave = highestOld
      await supabase.from('leaderboard').delete().eq('username', username.trim())
    }

    const { error: insertError } = await supabase
      .from('leaderboard')
      .insert([{ username: username.trim(), score: scoreToSave }])

    if (insertError) {
      return error('Veritabanı hatası: ' + insertError.message)
    }

    return new Response(
      JSON.stringify({ success: true, score: scoreToSave }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return error('Sunucu hatası: ' + e.message)
  }
})

function error(msg: string) {
  console.warn('[score-submit] REDDEDILDI:', msg)
  return new Response(
    JSON.stringify({ success: false, error: msg }),
    { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
