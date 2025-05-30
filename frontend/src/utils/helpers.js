export function createImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });
}