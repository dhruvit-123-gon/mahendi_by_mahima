function updateMainImage(thumbnail) {
  const main = document.getElementById('mainImage');
  const newSrc = thumbnail.src.replace('100x120', '500x600'); // update to bigger image
  main.src = newSrc;
}
