import { Skia } from '@shopify/react-native-skia';

export const headerRefractiveRibbon = Skia.RuntimeEffect.Make(`
uniform mat3 transform;
uniform vec2 resolution;
uniform vec4 box;
uniform vec4 radii;
uniform shader image;
uniform shader blurredImage;

float sdRoundedBoxCorners(vec2 p, vec2 b, vec4 r) {
  float rx;
  if (p.y < 0.0) {
    rx = (p.x >= 0.0) ? r.y : r.x;
  } else {
    rx = (p.x >= 0.0) ? r.z : r.w;
  }
  vec2 q = abs(p) - b + rx;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rx;
}

vec2 project(vec2 xy, mat3 m) {
  vec3 result = inverse(m) * vec3(xy, 1.0);
  return result.xy;
}

float sdf(vec2 xy) {
  vec2 p = project(xy, transform);
  vec2 halfSize = box.zw * 0.5;
  vec2 local = p - box.xy - halfSize;
  return sdRoundedBoxCorners(local, halfSize, radii);
}

vec2 gradient(vec2 xy) {
  float eps = 0.5;
  float dx = sdf(xy + vec2(eps, 0.0)) - sdf(xy - vec2(eps, 0.0));
  float dy = sdf(xy + vec2(0.0, eps)) - sdf(xy - vec2(0.0, eps));
  return vec2(dx, dy) * 0.5;
}

float heightAt(float sd, float thickness) {
  if (sd >= 0.0) {
    return 0.0;
  }
  if (sd < -thickness) {
    return thickness;
  }
  float x = thickness + sd;
  return sqrt(max(thickness * thickness - x * x, 0.0));
}

vec3 normalFromGradient(float sd, vec2 g, float thickness) {
  float lenG = max(length(g), 0.0001);
  vec2 dir = g / lenG;
  float ncos = clamp((thickness + sd) / thickness, 0.0, 1.0);
  float nsin = sqrt(max(1.0 - ncos * ncos, 0.0));
  vec2 nxy = dir * ncos;
  return normalize(vec3(nxy, nsin));
}

vec4 renderGlass(float sd, vec2 g, vec2 fragCoord) {
  float thickness = 22.0;
  float ior = 1.5;
  float chroma = 0.05;
  vec3 I = vec3(0.0, 0.0, -1.0);
  vec3 N = normalFromGradient(sd, g, thickness);
  vec3 Rr = refract(I, N, 1.0 / ior);
  float h = heightAt(sd, thickness);
  float baseHeight = thickness * 8.0;
  float denom = max(-Rr.z, 0.0001);
  float refrLen = (h + baseHeight) / denom;
  vec2 refrBase = fragCoord + Rr.xy * refrLen;
  vec2 uv = refrBase / resolution;
  vec2 cOff = Rr.xy * chroma;
  float rr = blurredImage.eval((uv - cOff) * resolution).r;
  float gg = blurredImage.eval(uv * resolution).g;
  float bb = blurredImage.eval((uv + cOff) * resolution).b;
  vec3 refrCol = vec3(rr, gg, bb);
  vec3 Rf = reflect(I, N);
  float rden = max(-Rf.z, 0.0001);
  float refLen = (h + baseHeight * 0.5) / rden;
  vec2 refBase = fragCoord + Rf.xy * refLen;
  vec3 refCol = image.eval(refBase).rgb;
  float cosT = clamp(dot(-I, N), 0.0, 1.0);
  float F0 = 0.04;
  float F = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
  vec3 color = mix(refrCol, refCol, F);
  float center = clamp((-sd) / thickness, 0.0, 1.0);
  color = mix(color, color + vec3(0.10), 0.30 * center);
  float band = smoothstep(0.0, 0.8, -sd) * (1.0 - smoothstep(0.8, 1.6, -sd));
  color = mix(color, color + vec3(0.25), 0.15 * band);
  return vec4(clamp(color, 0.0, 1.0), 1.0);
}

vec4 render(vec2 fragCoord) {
  float d = sdf(fragCoord);
  if (d > 0.0) {
    return image.eval(fragCoord);
  }
  vec2 g = gradient(fragCoord);
  return renderGlass(d, g, fragCoord);
}

vec4 main(vec2 fragCoord) {
  const int samples = 4;
  float weight = 1.0 / float(samples * samples);
  vec4 color = vec4(0.0);
  for (int i = 0; i < samples; ++i) {
    for (int j = 0; j < samples; ++j) {
      vec2 offset = vec2(float(i), float(j)) / float(samples) - 0.5 / float(samples);
      vec2 coord = fragCoord + offset;
      color += render(coord) * weight;
    }
  }
  return color;
}
`)!;
