param([switch]$Verify)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gainStepDb = 20 * [Math]::Log10([Math]::Pow(2, .25))

# K-weighting audit에서 산출한 총 파일 gain입니다. peak는 디코딩 단계에서 먼저
# 클리핑되지 않도록 MP3 global_gain에 넣을 수 있는 몫을 제한할 때 사용합니다.
$specs = @(
  @{Name='bgm_night.mp3';Gain=3.5215;Peak=-15.84;CallDb=0;Bus=.65},
  @{Name='sfx_pan_sizzle_loop.MP3';Gain=1.7128;Peak=-6.06;CallDb=-3.10;Bus=.72},
  @{Name='sfx_gas_flame_loop.MP3';Gain=1.1806;Peak=-14.07;CallDb=-3.10;Bus=.72},
  @{Name='sfx_cut_crisp.MP3';Gain=1.2380;Peak=-5.86;CallDb=0;Bus=.72},
  @{Name='sfx_cut_soft.MP3';Gain=2.0850;Peak=-7.38;CallDb=0;Bus=.72},
  @{Name='sfx_cut_meat2.MP3';Gain=1.2308;Peak=-5.85;CallDb=0;Bus=.72},
  @{Name='sfx_metal_scrape1.MP3';Gain=1.4257;Peak=-7.59;CallDb=0;Bus=.72},
  @{Name='sfx_metal_scrape2.MP3';Gain=1.3135;Peak=-6.89;CallDb=0;Bus=.72},
  @{Name='sfx_wood_stir1.MP3';Gain=1.9263;Peak=-16.40;CallDb=0;Bus=.72},
  @{Name='sfx_wood_stir2.MP3';Gain=1.6239;Peak=-7.22;CallDb=0;Bus=.72},
  @{Name='sfx_mandoline_slide1.MP3';Gain=1.0335;Peak=-10.75;CallDb=0;Bus=.72},
  @{Name='sfx_mandoline_slide2.MP3';Gain=1.0143;Peak=-9.78;CallDb=0;Bus=.72},
  @{Name='sfx_plate_tofu_place.MP3';Gain=11.9402;Peak=-21.63;CallDb=-.92;Bus=.72},
  @{Name='sfx_charcoal_grill_loop.MP3';Gain=7.8470;Peak=-20.15;CallDb=-3.10;Bus=.72},
  @{Name='sfx_whisk_mix_loop1.MP3';Gain=1.0956;Peak=-7.12;CallDb=-3.10;Bus=.72},
  @{Name='sfx_whisk_mix_loop2.MP3';Gain=1.1446;Peak=-4.77;CallDb=-3.10;Bus=.72},
  @{Name='sfx_input_wrong.MP3';Gain=1.2868;Peak=-16.83;CallDb=-.92;Bus=.72},
  @{Name='sfx_timer_warning.MP3';Gain=2.5025;Peak=-11.79;CallDb=0;Bus=.72},
  @{Name='sfx_ui_click.MP3';Gain=2.1700;Peak=-9.52;CallDb=0;Bus=.72},
  @{Name='sfx_next_book.MP3';Gain=1.2194;Peak=-8.29;CallDb=0;Bus=.72},
  @{Name='sfx_pour_thin.MP3';Gain=4.2637;Peak=-16.85;CallDb=0;Bus=.72},
  @{Name='sfx_pour_thick.MP3';Gain=5.6207;Peak=-16.71;CallDb=0;Bus=.72},
  @{Name='sfx_pour_syrup.MP3';Gain=5.6207;Peak=-16.71;CallDb=0;Bus=.72},
  @{Name='sfx_pour_water.MP3';Gain=1.0831;Peak=-7.48;CallDb=0;Bus=.72},
  @{Name='sfx_pour_pancake_flour.MP3';Gain=7.0845;Peak=-21.50;CallDb=0;Bus=.72},
  @{Name='sfx_drop_pancake_kimchi.MP3';Gain=1.3914;Peak=-6.98;CallDb=0;Bus=.72},
  @{Name='sfx_fries_starch_bag_shake1.MP3';Gain=1.1465;Peak=-11.51;CallDb=0;Bus=.72},
  @{Name='sfx_fries_starch_bag_shake2.MP3';Gain=1.1606;Peak=-8.64;CallDb=0;Bus=.72},
  @{Name='sfx_soak_ingredient_drop.MP3';Gain=1.8766;Peak=-6.47;CallDb=0;Bus=.72},
  @{Name='sfx_shrimp_flour_coat.MP3';Gain=8.5807;Peak=-22.50;CallDb=0;Bus=.72},
  @{Name='sfx_shrimp_egg_coat.MP3';Gain=3.7964;Peak=-12.59;CallDb=0;Bus=.72},
  @{Name='sfx_shrimp_crumb_coat.MP3';Gain=3.9927;Peak=-18.95;CallDb=0;Bus=.72},
  @{Name='sfx_skewer_turn.MP3';Gain=1.3004;Peak=-13.48;CallDb=0;Bus=.72},
  @{Name='sfx_anchovy_tension1.MP3';Gain=2.5138;Peak=-10.14;CallDb=0;Bus=.72},
  @{Name='sfx_anchovy_tension2.MP3';Gain=1.6571;Peak=-5.39;CallDb=0;Bus=.72},
  @{Name='sfx_rain.MP3';Gain=1.1379;Peak=-3.77;CallDb=-7.54;Bus=.72},
  @{Name='sfx_open_door.MP3';Gain=1.3958;Peak=-6.99;CallDb=-.92;Bus=.72},
  @{Name='sfx_story_d1_raindrop_arrival.MP3';Gain=1.9566;Peak=-3.09;CallDb=-3.74;Bus=.72},
  @{Name='sfx_story_d2_lantern_arrival.MP3';Gain=2.6301;Peak=-9.75;CallDb=-3.74;Bus=.72},
  @{Name='sfx_story_d4_crow_letter_arrival.MP3';Gain=1.7864;Peak=-10.73;CallDb=-3.74;Bus=.72},
  @{Name='sfx_story_d5_star_beast_arrival.MP3';Gain=1.1910;Peak=-11.18;CallDb=-3.74;Bus=.72},
  @{Name='sfx_story_d6_seawater_arrival.MP3';Gain=2.4915;Peak=-11.25;CallDb=-3.74;Bus=.72},
  @{Name='sfx_story_d7_clock_444_arrival.MP3';Gain=1.7819;Peak=-12.53;CallDb=-3.74;Bus=.72}
)

function Get-Bits([byte[]]$data,[int]$startByte,[int]$bitOffset,[int]$count) {
  $value = 0
  for($index=0;$index -lt $count;$index++) {
    $absolute = $bitOffset + $index
    $mask = 1 -shl (7 - ($absolute % 8))
    $byteIndex=$startByte+[int][Math]::Floor($absolute/8)
    $value = ($value -shl 1) -bor ($(if(($data[$byteIndex] -band $mask) -ne 0){1}else{0}))
  }
  return $value
}

function Set-Bits([byte[]]$data,[int]$startByte,[int]$bitOffset,[int]$count,[int]$value) {
  for($index=0;$index -lt $count;$index++) {
    $absolute = $bitOffset + $index
    $byteIndex = $startByte + [int][Math]::Floor($absolute/8)
    $mask = 1 -shl (7 - ($absolute % 8))
    $sourceMask = 1 -shl ($count - 1 - $index)
    if(($value -band $sourceMask) -ne 0) {$data[$byteIndex] = [byte]($data[$byteIndex] -bor $mask)}
    else {$data[$byteIndex] = [byte]($data[$byteIndex] -band (0xff -bxor $mask))}
  }
}

function Add-Mp3GlobalGain([byte[]]$data,[int]$steps) {
  $offset = 0
  if($data.Length -ge 10 -and $data[0] -eq 0x49 -and $data[1] -eq 0x44 -and $data[2] -eq 0x33) {
    $tagSize = (($data[6] -band 0x7f) -shl 21) -bor (($data[7] -band 0x7f) -shl 14) -bor (($data[8] -band 0x7f) -shl 7) -bor ($data[9] -band 0x7f)
    $offset = 10 + $tagSize + $(if(($data[5] -band 0x10) -ne 0){10}else{0})
  }
  $frames = 0;$fields = 0
  while($offset + 4 -le $data.Length) {
    $b1=$data[$offset+1];$b2=$data[$offset+2];$b3=$data[$offset+3]
    $version=($b1 -shr 3) -band 3;$layer=($b1 -shr 1) -band 3
    $bitrateIndex=($b2 -shr 4) -band 15;$sampleIndex=($b2 -shr 2) -band 3
    if($data[$offset] -ne 0xff -or ($b1 -band 0xe0) -ne 0xe0 -or $version -eq 1 -or $layer -ne 1 -or $bitrateIndex -in 0,15 -or $sampleIndex -eq 3) {$offset++;continue}
    if(($b1 -band 1) -eq 0) {throw 'CRC-protected MP3 frames are not supported.'}
    $mpeg1=$version -eq 3
    $rates=if($mpeg1){@(0,32,40,48,56,64,80,96,112,128,160,192,224,256,320)}else{@(0,8,16,24,32,40,48,56,64,80,96,112,128,144,160)}
    $samples=@(44100,48000,32000);$sampleRate=$samples[$sampleIndex]
    if($version -eq 2){$sampleRate=[int]($sampleRate/2)}elseif($version -eq 0){$sampleRate=[int]($sampleRate/4)}
    $frameLength=[int]([Math]::Floor($(if($mpeg1){144}else{72})*$rates[$bitrateIndex]*1000/$sampleRate))+(($b2 -shr 1)-band 1)
    if($frameLength -le 4 -or $offset+$frameLength -gt $data.Length){$offset++;continue}
    $mono=(($b3 -shr 6)-band 3) -eq 3;$channels=if($mono){1}else{2};$sideStart=$offset+4
    if($mpeg1){
      $infoStart=9+$(if($mono){5}else{3})+4*$channels
      for($granule=0;$granule -lt 2;$granule++) {for($channel=0;$channel -lt $channels;$channel++) {
        $gainOffset=$infoStart+(($granule*$channels+$channel)*59)+21
        $gain=Get-Bits $data $sideStart $gainOffset 8
        Set-Bits $data $sideStart $gainOffset 8 ([Math]::Min(255,$gain+$steps));$fields++
      }}
    } else {
      $infoStart=8+$(if($mono){1}else{2})
      for($channel=0;$channel -lt $channels;$channel++) {
        $gainOffset=$infoStart+($channel*63)+21
        $gain=Get-Bits $data $sideStart $gainOffset 8
        Set-Bits $data $sideStart $gainOffset 8 ([Math]::Min(255,$gain+$steps));$fields++
      }
    }
    $frames++;$offset+=$frameLength
  }
  if($frames -eq 0 -or $fields -eq 0){throw 'No MPEG Layer III audio frames were found.'}
  return @{Frames=$frames;Fields=$fields}
}

$sourceText=[System.IO.File]::ReadAllText((Join-Path $root 'js\game.js'))
$pathMatches=[regex]::Matches($sourceText,'["''](assets\/(?:bgm|sfx)\/[^"'']+\.mp3)["'']','IgnoreCase')
$pathsByName=@{}
foreach($match in $pathMatches){
  $relative=$match.Groups[1].Value;$fileName=[System.IO.Path]::GetFileName($relative);$pathsByName[$fileName]=$relative
  if($fileName -match '^(.*)_leveled(\.[^.]+)$'){
    $originalName=$matches[1]+$matches[2]
    $pathsByName[$originalName]=$relative -replace '_leveled(?=\.[^./]+$)',''
  }
}

$results=@()
foreach($spec in $specs){
  $relative=$pathsByName[$spec.Name];if(!$relative){throw "Audio path not found: $($spec.Name)"}
  $source=[System.IO.Path]::GetFullPath((Join-Path $root $relative))
  if(!$source.StartsWith($root+[System.IO.Path]::DirectorySeparatorChar)){throw "Path escaped workspace: $source"}
  $wanted=[Math]::Max(0,[int][Math]::Floor((20*[Math]::Log10($spec.Gain))/$gainStepDb))
  $peakLimit=[Math]::Max(0,[int][Math]::Floor((-1-$spec.Peak)/$gainStepDb))
  $steps=[Math]::Min($wanted,$peakLimit)
  $coarse=[Math]::Pow(2,$steps/4);$runtime=$spec.Gain/$coarse
  $call=[Math]::Pow(10,$spec.CallDb/20)
  if($runtime*$call*$spec.Bus -gt 1.0001){throw "Direct-play volume would clip: $($spec.Name)"}
  $target=$relative
  if($steps -gt 0){
    $directory=[System.IO.Path]::GetDirectoryName($source);$stem=[System.IO.Path]::GetFileNameWithoutExtension($source);$extension=[System.IO.Path]::GetExtension($source)
    $targetPath=Join-Path $directory ($stem+'_leveled'+$extension)
    $target=$relative.Substring(0,$relative.LastIndexOf('/')+1)+$stem+'_leveled'+$extension
    if(!$Verify){$bytes=[System.IO.File]::ReadAllBytes($source);$stats=Add-Mp3GlobalGain $bytes $steps;[System.IO.File]::WriteAllBytes($targetPath,$bytes)}
    elseif(!(Test-Path -LiteralPath $targetPath)){throw "Missing leveled file: $targetPath"}
  }
  $results += [pscustomobject]@{Name=$spec.Name;Path=$target;Steps=$steps;RuntimeGain=[Math]::Round($runtime,4)}
}
$results | Format-Table -AutoSize
