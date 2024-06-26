import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useFonts, Poppins_700Bold, Poppins_400Regular } from '@expo-google-fonts/poppins';
import UserPost from './userPost';
import PostItem from './postItem';
import FeatherIcon from 'react-native-vector-icons/Feather';
import MatIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNewestPostId, getPosts } from "../backend/Firebase/posts.js";
import { getTrack, getTracks, spotifyProfilePic } from "../backend/SpotifyAPI/functions.js";
import { getUserUsername, getUserFollowing } from '../backend/Firebase/users.js';
import spinner from '../assets/spinner.gif';
import { Image } from "react-native";
const defaultProfilePic = require('../assets/default-pfp.png');
import { defaultTrack as unformattedDefaultTrack } from "../backend/SpotifyAPI/functions.js";

const Feed = ({ navigation }) => {
    const [posted, setPosted] = useState(false);
    const [songDetails, setSongDetails] = useState({ songCover: '.', songTitle: '.', songArtist: '.' });
    const [feedPosts, setFeedPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userCache, setUserCache] = useState({}); // userId => {username, profilePic}
    const [trackCache, setTrackCache] = useState({}); // trackId => {songCover, songTitle, songArtist, songPreview, trackUri}

    useFocusEffect(
        React.useCallback(() => {
            setIsLoading(true);
            console.log("focusing on feed!");
            const fetchUserPost = async () => {
                try {
                    const userId = await AsyncStorage.getItem('global_user_id');
                    const newestPost = await getNewestPostId(userId);

                    if (newestPost == undefined) {
                        setPosted(false);
                    } else {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        const postDate = new Date(newestPost.date.seconds * 1000 + newestPost.date.nanoseconds / 1000000);
                        postDate.setHours(0, 0, 0, 0);

                        if (postDate.getTime() === today.getTime()) {
                            setPosted(true);

                            if (!newestPost.track_uri.startsWith('spotify:track:')) {
                                throw new Error('Invalid track URI');
                            }

                            if (!(newestPost.track_uri in trackCache)) {
                                // const trackUri = newestPost.track_uri;
                                console.log("newestPost.track_uri", newestPost.track_uri);
                                // if (trackUri) {
                                const trackId = newestPost.track_uri.split(':')[2];
                                const todaySong = await getTrack(userId, trackId);
                                console.log("todaySong", todaySong); // DEBUG
                                trackCache[newestPost.track_uri] = {
                                    songCover: todaySong.album.images[0] ? todaySong.album.images[0].url : null,
                                    songTitle: todaySong.name,
                                    songArtist: todaySong.artists.map((artist) => artist.name).join(", "),
                                    songPreview: todaySong.preview_url,
                                    trackUri: todaySong.uri,
                                };
                                setTrackCache(trackCache);

                                // setSongDetails(setSongDetails(trackCache[newestPost.track_uri]));
                                // } else {
                                    // const trackId = unformattedDefaultTrack.id;
                                    // const todaySong = defaultTrack;
                                    // // console.log("todaySong", todaySong); // DEBUG
                                    // trackCache[newestPost.track_uri] = {
                                    //     songCover: todaySong.album.images[0] ? todaySong.album.images[0].url : null,
                                    //     songTitle: todaySong.name,
                                    //     songArtist: todaySong.artists.map((artist) => artist.name).join(", ")
                                    // };
                                    // setSongDetails(setSongDetails(trackCache[newestPost.track_uri]));
                                // }
                            }
                            setSongDetails(trackCache[newestPost.track_uri]);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user post or track details:', error);
                }
            };

            const fetchFeedPosts = async () => {
                try {
                    const globalUserId = await AsyncStorage.getItem('global_user_id');
                    const allPosts = await getPosts();
                    if (!allPosts) {
                        console.error('No posts found');
                        return;
                    }
                    const friends = await getUserFollowing(globalUserId);
                    friends.push(globalUserId);
                    // console.log("friends", friends); // DEBUG
                    const userPromises = [];
                    const trackIds = [];

                    for (const userId of friends) {
                        if (!(userId in userCache)) {
                            // console.log("userId", userId, "not in userCache)"); // DEBUG
                            userPromises.push(userId);
                            userPromises.push(getUserUsername(userId));
                            userPromises.push(spotifyProfilePic(userId));
                        }
                        for (const postId in allPosts[userId]) {
                            const post = allPosts[userId][postId];
                            const trackId = post.track_uri.split(':')[2];
                            if (!(trackId in trackCache)) {
                                trackIds.push(trackId);
                            }
                        }
                    }


                    const userResults = await Promise.all(userPromises);
                    for (let i = 0; i < userResults.length; i += 3) {
                        const userId = userResults[i];
                        userCache[userId] = {
                            username: userResults[i + 1],
                            profilePic: userResults[i + 2] // [0].url
                        };
                    }

                    console.log("trackIds", trackIds); // DEBUG
                    let trackResults;
                    if (trackIds.length > 0) {
                        trackResults = await getTracks(globalUserId, trackIds);
                    } else {
                        trackResults = [];
                    }
                    // console.log("trackResults", trackResults); // DEBUG
                    for (const track of trackResults) {
                        // console.log("track", track); // DEBUG
                        trackCache[track.id] = {
                            songCover: track.album.images[0] ? track.album.images[0].url : null,
                            songTitle: track.name,
                            songArtist: track.artists.map((artist) => artist.name).join(", "),
                            songPreview: track.preview_url,
                            trackUri: track.uri,
                        };
                    }


                    setUserCache(userCache);
                    setTrackCache(trackCache);

                    // console.log("allPosts", allPosts); // DEBUG
                    // console.log("userCache", userCache); // DEBUG
                    // console.log("trackCache", trackCache); // DEBUG

                    const posts = [];
                    for (const userId of friends) {
                        posts.push(...Object.keys(allPosts[userId]).map((postId) => {
                            const post = allPosts[userId][postId];
                            const user = userCache[userId];
                            const track = trackCache[post.track_uri.split(':')[2]] || defaultTrack;
                            
                            // console.log("post", post); // DEBUG
                            // console.log("user", user); // DEBUG
                            // console.log("track", track); // DEBUG
                            return {
                                id: `${userId}-${postId}`,
                                date: post.date.toDate(),
                                profilePic: user.profilePic || defaultProfilePic, // TODO?
                                username: user.username,
                                songCover: track.songCover,
                                songTitle: track.songTitle,
                                songArtist: track.songArtist,
                                postDate: post.date,
                                songPreview: track.songPreview,
                                trackUri: track.trackUri,
                            };
                        }));
                    }
                    posts.sort((a, b) => b.date - a.date);
                    setFeedPosts(posts);
                    setIsLoading(false);








                    
                    // const friendPromises = friends.map(async (userId) => {
                    //     if (!allPosts.hasOwnProperty(userId)) {
                    //         return;
                    //     }
                    //     const user = allPosts[userId];
                    //     // const username = await getUserUsername(userId);
                    //     // const profilePic = await spotifyProfilePic(userId);
                    //     const username = userData[userId].username;
                    //     const profilePic = userData[userId].profilePic;

                    //     // Process each post in parallel
                    //     const postPromises = Object.keys(user).map(async (postId) => {
                    //         const curr_post = user[postId];

                    //         if (!curr_post.track_uri.startsWith('spotify:track:')) {
                    //             throw new Error('Invalid track URI');
                    //         }
                    //         const curr_trackId = curr_post.track_uri.split(':')[2];
                    //         const curr_track = await getTrack(userId, curr_trackId);
                    //         // console.log("curr_track", curr_track); // DEBUG

                    //         return {
                    //             id: `${userId}-${postId}`,
                    //             date: curr_post.date.toDate(),
                    //             profilePic: profilePic?.[0]?.url || 'default_profile_pic_url',
                    //             username: username,
                    //             songCover: curr_track.album.images[0] ? curr_track.album.images[0].url : null,
                    //             songTitle: curr_track.name,
                    //             songArtist: curr_track.artists.map((artist) => artist.name).join(", "),
                    //             postDate: curr_post.date,
                    //             songPreview: curr_track.preview_url,
                    //             trackUri: curr_track.uri,
                    //         };
                    //     });

                    //     const userPosts = await Promise.all(postPromises);
                    //     posts.push(...userPosts);
                    // });

                    // await Promise.all(friendPromises);

                    // posts.sort((a, b) => b.date - a.date);
                    // setFeedPosts(posts);
                    // // console.log("posts ", posts); // DEBUG
                    // // console.log("feedPosts ", feedPosts); // DEBUG
                    // setIsLoading(false);








                } catch (error) {
                    console.error('Error fetching posts or track details:', error);
                }
            };













            //         const userPromises = [];
            //         const postPromises = [];

            //         // Create a batch of promises to fetch user data and post data in parallel
            //         for (const userId in allPosts) {
            //             // Fetch usernames and profile pictures for each user
            //             userPromises.push(getUserUsername(userId));
            //             userPromises.push(spotifyProfilePic(userId));

            //             //   // Fetch track data for each post in parallel
            //             //   for (const postId in allPosts[userId]) {
            //             //     const post = allPosts[userId][postId];
            //             //     postPromises.push(
            //             //       getTrack(
            //             //         await AsyncStorage.getItem("global_user_id"),
            //             //         post.track_uri.split(":")[2]
            //             //       )
            //             //     );
            //             //   }
            //         }
            //         // let trackIds = [];
            //         // for (const postId in allPosts[userId]) {
            //         //     const post = allPosts[userId][postId];
            //         //     trackIds.push(post.track_uri.split(":")[2]);
            //         // }
            //         // const postPromise = getTracks(await AsyncStorage.getItem("global_user_id"), trackIds);
            //         // Wait for all track data to be fetched
            //         // const postResults = await Promise.all(postPromises);
            //         // let postResults = await postPromise;

            //         // Wait for all user data to be fetched
            //         const userResults = await Promise.all(userPromises);

            //         // Now userResults and postResults should contain the resolved data
            //         // console.log("User data:", userResults);
            //         // console.log("Post data:", postResults);

            //         const userData = {};
            //         let userIndex = 0;

            //         // Organize user data into a dictionary for quick lookup
            //         for (const userId in allPosts) {
            //             userData[userId] = {
            //                 username: userResults[userIndex],
            //                 profilePic: userResults[userIndex + 1]?.[0]?.url
            //             };
            //             userIndex += 2;
            //         }

            //         const posts = [];

            //         // Fetch the list of friends
            //         const friends = await getUserFollowing(await AsyncStorage.getItem('global_user_id'));
            //         friends.push(await AsyncStorage.getItem('global_user_id'));

            //         // Process each friend in parallel
            //         const friendPromises = friends.map(async (userId) => {
            //             if (!allPosts.hasOwnProperty(userId)) {
            //                 return;
            //             }

            //             const user = allPosts[userId];
            //             // const username = await getUserUsername(userId);
            //             // const profilePic = await spotifyProfilePic(userId);
            //             const username = userData[userId].username;
            //             const profilePic = userData[userId].profilePic;

            //             // Process each post in parallel
            //             const postPromises = Object.keys(user).map(async (postId) => {
            //                 const curr_post = user[postId];

            //                 if (!curr_post.track_uri.startsWith('spotify:track:')) {
            //                     throw new Error('Invalid track URI');
            //                 }
            //                 const curr_trackId = curr_post.track_uri.split(':')[2];
            //                 const curr_track = await getTrack(userId, curr_trackId);
            //                 // console.log("curr_track", curr_track); // DEBUG

            //                 return {
            //                     id: `${userId}-${postId}`,
            //                     date: curr_post.date.toDate(),
            //                     profilePic: profilePic?.[0]?.url || 'default_profile_pic_url',
            //                     username: username,
            //                     songCover: curr_track.album.images[0] ? curr_track.album.images[0].url : null,
            //                     songTitle: curr_track.name,
            //                     songArtist: curr_track.artists.map((artist) => artist.name).join(", "),
            //                     postDate: curr_post.date,
            //                     songPreview: curr_track.preview_url,
            //                     trackUri: curr_track.uri,
            //                 };
            //             });

            //             const userPosts = await Promise.all(postPromises);
            //             posts.push(...userPosts);
            //         });

            //         await Promise.all(friendPromises);

            //         posts.sort((a, b) => b.date - a.date);
            //         setFeedPosts(posts);
            //         // console.log("posts ", posts); // DEBUG
            //         // console.log("feedPosts ", feedPosts); // DEBUG
            //         setIsLoading(false);
            //     } catch (error) {
            //         console.error('Error fetching posts or track details:', error);
            //     }
            // };












            fetchUserPost();
            fetchFeedPosts();

            // return () => checkFeedUpdates();
        }, [])
    );

    let [fontsLoaded] = useFonts({
        Poppins_700Bold,
        Poppins_400Regular
    });

    if (!fontsLoaded) {
        return null;
    }

    // const posts = [
    //     {
    //         profilePic: require('../assets/concert.png'),
    //         username: 'johnjohn',
    //         songCover: require('../assets/heros-cover.png'),
    //         songTitle: 'Superhero',
    //         songArtist: 'Metro Boomin, Future, Chris Brown'
    //     },
    //     {
    //         profilePic: require('../assets/concert.png'),
    //         username: 'johnjohn',
    //         songCover: require('../assets/heros-cover.png'),
    //         songTitle: 'Superhero',
    //         songArtist: 'Metro Boomin, Future, Chris Brown'
    //     },
    //     {
    //         profilePic: require('../assets/concert.png'),
    //         username: 'johnjohn',
    //         songCover: require('../assets/heros-cover.png'),
    //         songTitle: 'Superhero',
    //         songArtist: 'Metro Boomin, Future, Chris Brown'
    //     },
    //     {
    //         profilePic: require('../assets/concert.png'),
    //         username: 'johnjohn',
    //         songCover: require('../assets/heros-cover.png'),
    //         songTitle: 'Superhero',
    //         songArtist: 'Metro Boomin, Future, Chris Brown'
    //     },
    //     {
    //         profilePic: require('../assets/concert.png'),
    //         username: 'johnjohn',
    //         songCover: require('../assets/heros-cover.png'),
    //         songTitle: 'Superhero',
    //         songArtist: 'Metro Boomin, Future, Chris Brown'
    //     },
    // ];

    return (<View style={styles.container}>
        <View>
            <View style={styles.topBar}>
                <View style={styles.leftIcon}>
                    <TouchableOpacity onPress={() => navigation.push('FriendsList')} >
                        <FeatherIcon name='users' size={20} style={styles.iconTopStyle} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.push('Playlist')}>
                        <MatIcon name='playlist-music' size={20} style={styles.iconTopStyle} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.navTitle}>Hi-Five</Text>
                <TouchableOpacity onPress={() => navigation.push('ProfileScreen')}>
                    <FeatherIcon name='settings' size={20} style={styles.iconTopStyle} />
                </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity onPress={onPress = () => navigation.push('SongSelector')}>
                    <UserPost posted={posted} {...songDetails} />
                </TouchableOpacity>
                {/*isLoading && 
                    <View style={styles.loading}>
                        <Image style={styles.image} source={spinner} />
                    </View>
                */}
                {feedPosts.map((post, index) => (
                    <PostItem
                        key={post.id}
                        profilePic={post.profilePic || defaultProfilePic}
                        username={post.username}
                        songCover={post.songCover}
                        songTitle={post.songTitle}
                        songArtist={post.songArtist}
                        songPreview={post.songPreview || "https://p.scdn.co/mp3-preview/2c08c5c6325fb502aa4b94c3880f06095114b22d?cid=1afd86bd959b46549fad0dc7389b1f1a"}
                        trackUri={post.trackUri}
                        postDate={post.postDate}
                    />
                ))}
            </ScrollView>
        </View>
    </View>)
}

export default Feed;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: '#202020',
        alignItems: 'center',
    },
    iconTopStyle: {
        justifyContent: "center",
        paddingVertical: 2,
        paddingHorizontal: 5,
        color: '#B2EED3'
    },
    topBar: {
        marginTop: 60,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
    },
    navTitle: {
        color: '#B2EED3',
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
        paddingRight: 20,
    },
    leftIcon: {
        flexDirection: 'row',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
    },
    image: {
        width: '40%',
        height: undefined,
        aspectRatio: 1,
        resizeMode: 'contain',
    },
});

const defaultTrack = {
    songCover: unformattedDefaultTrack.album.images[0] ? unformattedDefaultTrack.album.images[0].url : null,
    songTitle: unformattedDefaultTrack.name,
    songArtist: unformattedDefaultTrack.artists.map((artist) => artist.name).join(", "),
    songPreview: unformattedDefaultTrack.preview_url,
    trackUri: unformattedDefaultTrack.uri,
};